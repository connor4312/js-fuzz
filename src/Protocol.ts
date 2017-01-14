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
    this.underlying = Buffer.allocUnsafe(size)
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
   * Peeks at the next byte in the buffer, returning null if it's out of range,
   * otherwise advancing the read pointer.
   */
  public peek(): number {
    return this.readPtr === this.writePtr ? null : this.underlying.readUInt8(this.readPtr++);
  }

  /**
   * Grows the underlying buffer to ensure there's space to write the
   * provided message.
   */
  private grow(size: number) {
    // Grow if the message is too large to fit in our buffer at all.
    for (let ulen = this.underlying.length; size >= ulen; ulen *= 2) {
      const next = Buffer.allocUnsafe(ulen * 2);
      this.underlying.copy(next, 0, this.readPtr, this.writePtr)
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
  fuzz(input: Buffer): WorkResult;
}

export enum PacketKind {
  Ready,
  CompletedWork,
  DoWork,
}

export interface IReadyCall {
  kind: PacketKind.Ready;
}

export enum WorkResult {
  Ignore,
  Allow,
  Reinforce,
  Error,
}

export interface ICompletedWork {
  kind: PacketKind.CompletedWork;
  result: WorkResult;
  error?: string;
  coverage?: number;
}

export interface IDoWork {
  kind: PacketKind.DoWork;
  input: Buffer;
}

export type ipcCall = ICompletedWork | IDoWork | IReadyCall;


/**
 * Protocol implements a super simple protobuf-based encoding on top of
 * readable and writable streams. Each message is length-prefix with a varint.
 */
export class Protocol extends EventEmitter {

  private input: NodeJS.ReadableStream;
  private output: NodeJS.WritableStream;
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
    this.input = input;
    this.output = output;

    input.on('data', data => {
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

    if (message.kind === PacketKind.DoWork) {
      this.output.write(
        Buffer.from(
          <any> new protobufjs.Writer()
            .uint32(message.input.length)
            .finish()
        )
      );
      this.output.write(message.input);
    } else {
      this.output.write(
        Buffer.from(<any> this.messages[PacketKind[message.kind]]
          .encodeDelimited(message)
          .finish()),
      );
    }
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
      let call: ipcCall;
      if (kindId === PacketKind.DoWork) {
        call = this.decodeDoWork(unread);
      } else {
        call = this.decodeMessage(kindId, unread);
      }

      if (!call) {
        return;
      }

      this.emit('message', call);
    }
  }

  private decodeDoWork(input: Buffer): ipcCall {
    const reader = new protobufjs.BufferReader(input);
    const length = reader.uint32();
    const end = reader.pos + length;
    if (end >= input.length) {
      this.inputBuffer.advanceRead(reader.pos + 1);
      return;
    }

    this.inputBuffer.advanceRead(end);
    return {
      kind: PacketKind.DoWork,
      input: input.slice(reader.pos, end),
    };
  }

  private decodeMessage(kindId: number, input: Buffer): ipcCall | null {
    const kind = this.messages[PacketKind[String(kindId)]];
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
      return; // rather naive to buffer infinitely,
    }

    this.inputBuffer.advanceRead(reader.pos);
    output.kind = kindId;
    return output;
  }

  public static load(file: string): Promise<Protocol> {
    return (<any> protobufjs).load(file).then(builder => new Protocol(builder));
  }
}
