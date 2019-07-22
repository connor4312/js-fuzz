import * as protobufjs from 'protobufjs';
import { Observable, Subject } from 'rxjs';
import { IPCCall, PacketKind } from './types';

/**
 * Protocol implements a super simple protobuf-based encoding on top of
 * readable and writable streams. Each message is length-prefix with a varint.
 */
export class Protocol {
  private output?: NodeJS.WritableStream;
  private messages: { [name: string]: protobufjs.Type } = require('./fuzz').fuzz;
  private inputBuffer = new RWBuffer();

  /**
   * Attaches an ipc reader/writer to the streams.
   */
  public attach(input: NodeJS.ReadableStream, output: NodeJS.WritableStream): Observable<IPCCall> {
    this.output = output;

    const out = new Subject<IPCCall>();
    input.on('data', (data: Buffer) => {
      this.inputBuffer.write(data);
      while (true) {
        const parsed = this.decodeInputs();
        if (!parsed) {
          return;
        }

        try {
          out.next(parsed);
        } catch (err) {
          out.error(err);
          return;
        }
      }
    });

    input.on('error', err => out.error(err));
    input.on('end', () => out.complete());

    return out;
  }

  /**
   * Writes the ipc call to the output stream.
   */
  public write(message: IPCCall) {
    if (!this.output) {
      throw new Error('Cannot write() without first calling attach()');
    }

    this.output.write(new Buffer([message.kind]));
    this.output.write(
      Buffer.from(this.messages[PacketKind[message.kind]].encodeDelimited(message).finish()),
    );
  }

  /**
   * Ends the underlying output stream.
   */
  public end() {
    if (this.output) {
      this.output.end();
    }
  }

  private decodeInputs() {
    const kindId = this.inputBuffer.peek();
    const unread = this.inputBuffer.getUnread();
    return this.decodeMessage(kindId, unread);
  }

  private decodeMessage(kindId: number, input: Buffer): IPCCall | null {
    const kind = this.messages[(<any>PacketKind)[String(kindId)]];
    if (!kind) {
      throw new Error(`Corrupt data stream: unknown message kind ${kindId}`);
    }

    const reader = new protobufjs.BufferReader(input);
    let output: IPCCall;
    try {
      output = <any>kind.decodeDelimited(reader);
    } catch (e) {
      if (!(e instanceof RangeError)) {
        throw new Error(`Error parsing data stream: ${e.message}`);
      }

      this.inputBuffer.advanceRead(-1);
      return null; // rather naive to buffer infinitely,
    }

    this.inputBuffer.advanceRead(reader.pos);
    output.kind = kindId;
    return output;
  }
}
