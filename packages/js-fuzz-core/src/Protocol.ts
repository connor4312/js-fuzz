import { EventEmitter } from 'events';
import * as protobufjs from 'protobufjs';

/**
 * RWBuffer is a simple implementation of a byte buffer with read and write pointers.
 */
class RWBuffer {
  private underlying: Buffer;
  private writePtr = 0;
  private readPtr = 0;

  constructor(size: number = 10 * 1024 * 1024) {
    this.underlying = Buffer.allocUnsafe(size);
  }

  /**
   * Copies the input buffer to the underlying storage.
   */
  public write(input: Buffer) {
    this.grow(input.length);
    input.copy(this.underlying, this.writePtr);
    this.writePtr += input.length;
  }

  /**
   * Returns the slice of the buffer that has been written but not read yet.
   * This will share memory with the underlying buffer and is NOT safe to
   * mutate or use after write() is called.
   */
  public getUnread(): Buffer {
    return this.underlying.slice(this.readPtr, this.writePtr);
  }

  /**
   * Advances the read pointer by the given amount.
   */
  public advanceRead(amount: number) {
    this.readPtr += amount;
  }

  /**
   * Returns the number of unread bytes in the buffer.
   */
  public length() {
    return this.writePtr - this.readPtr;
  }

  /**
   * Peeks at the next byte in the buffer, advancing the read pointer.
   */
  public peek(): number {
    if (this.readPtr === this.writePtr) {
      throw new RangeError('out of bound');
    }

    const byte = this.underlying.readUInt8(this.readPtr);
    this.readPtr += 1;
    return byte;
  }

  /**
   * Grows the underlying buffer to ensure there's space to write the
   * provided message.
   */
  private grow(size: number) {
    // Grow if the message is too large to fit in our buffer at all.
    for (let ulen = this.underlying.length; size >= ulen; ulen *= 2) {
      const next = Buffer.allocUnsafe(ulen * 2);
      this.underlying.copy(next, 0, this.readPtr, this.writePtr);
      this.writePtr -= this.readPtr;
      this.readPtr = 0;
      this.underlying = next;
    }

    // Reset the pointers and positioning if writing the message would go
    // past the end of the buffer.
    if (this.writePtr + size >= this.underlying.length) {
      this.underlying.copy(this.underlying, 0, this.readPtr, this.writePtr);
      this.writePtr -= this.readPtr;
      this.readPtr = 0;
    }
  }
}

/**
 * IModule is the module type we expect to be passed to
 */
export interface IModule {
  fuzz(input: Buffer, callback: (err: any, res: WorkResult) => void): void;
  fuzz(input: Buffer): Promise<WorkResult>;
  fuzz(input: Buffer): WorkResult;
}

export enum PacketKind {
  Ready,
  WorkSummary,
  RequestCoverage,
  WorkCoverage,
  DoWork,
}

/**
 * An IReady message is sent from workers when their code is loaded and ready to go.
 */
export interface IReadyCall {
  kind: PacketKind.Ready;
}

export enum WorkResult {
  Ignore,
  Allow,
  Reinforce,
  Error,
}

/**
 * An IRequestCoverage is sent from the master to the slave if the work
 * resulted in something that looks interesting.
 */
export interface IRequestCoverage {
  kind: PacketKind.RequestCoverage;
}

/**
 * A WorkSummary is sent from the slave to the master when work is completed.
 */
export interface IWorkSummary {
  kind: PacketKind.WorkSummary;
  result: WorkResult;
  coverageSize: number;
  inputLength: number;
  hash: string;
  runtime: number; // given in microseconds
  error?: string;
}

/**
 * An IWorkCoverage is sent in response to an IRequestCoverage message.
 */
export interface IWorkCoverage {
  kind: PacketKind.WorkCoverage;
  coverage: Buffer;
}

/**
 * IDoWork is sent to signal a slave that we want to fuzz the given input.
 */
export interface IDoWork {
  kind: PacketKind.DoWork;
  input: Buffer;
}

export type ipcCall = IWorkSummary | IDoWork | IReadyCall | IWorkCoverage | IRequestCoverage;

/**
 * Protocol implements a super simple protobuf-based encoding on top of
 * readable and writable streams. Each message is length-prefix with a varint.
 */
export class Protocol extends EventEmitter {
  private output!: NodeJS.WritableStream;
  private messages: { [name: string]: protobufjs.Type };
  private inputBuffer = new RWBuffer();

  constructor(messages: { fuzz: { [name: string]: protobufjs.Type }}) {
    super();
    this.messages = messages.fuzz;
  }

  /**
   * Attaches an ipc reader/writer to the streams.
   */
  public attach(input: NodeJS.ReadableStream, output: NodeJS.WritableStream) {
    this.output = output;

    input.on('data', (data: Buffer) => {
      this.inputBuffer.write(data);
      this.decodeInputs();
    });

    input.on('error', () => this.emit('error'));

    input.on('end', () => this.emit('end'));
  }

  /**
   * Writes the ipc call to the output stream.
   */
  public write(message: ipcCall) {
    this.output.write(new Buffer([message.kind]));
    this.output.write(
      Buffer.from(<any> this.messages[PacketKind[message.kind]]
        .encodeDelimited(message)
        .finish()),
    );
  }

  /**
   * Ends the underlying output stream.
   */
  public end() {
    this.output.end();
  }

  private decodeInputs() {
    while (this.inputBuffer.length() > 0) {
      const kindId = this.inputBuffer.peek();
      const unread = this.inputBuffer.getUnread();
      const call = this.decodeMessage(kindId, unread);

      if (!call) {
        return;
      }

      this.emit('message', call);
    }
  }

  private decodeMessage(kindId: number, input: Buffer): ipcCall | null {
    const kind = this.messages[(<any> PacketKind)[String(kindId)]];
    if (!kind) {
      throw new Error(`Corrupt data stream: unknown message kind ${kindId}`);
    }

    const reader = new protobufjs.BufferReader(input);
    let output: ipcCall;
    try {
      output = <any> kind.decodeDelimited(reader);
    } catch (e) {
      if (!(e instanceof RangeError)) {
        this.emit('error', new Error(`Error parsing data stream: ${e.message}`));
      }

      this.inputBuffer.advanceRead(-1);
      return null; // rather naive to buffer infinitely,
    }

    this.inputBuffer.advanceRead(reader.pos);
    output.kind = kindId;
    return output;
  }
}
