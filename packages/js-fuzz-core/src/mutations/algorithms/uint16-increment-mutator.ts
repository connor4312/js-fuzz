import { injectable } from "inversify";
import { IMutationAlgorithm } from ".";
import { randn } from "../../Math";
import { dupe, roughWrap } from "./util";

@injectable()
export class Uint16IncrementMutator implements IMutationAlgorithm {
  public mutate(buffer: Buffer) {
    if (buffer.length < 2) {
      return null;
    }

    const index = randn(buffer.length - 2);
    const amount = Math.random() > 0.5 ? 1 : -1;
    buffer = dupe(buffer);
    if (Math.random() > 0.5) {
      buffer.writeUInt16BE(roughWrap(buffer.readUInt16BE(index) + amount, 0xffff), index);
    } else {
      buffer.writeUInt16LE(roughWrap(buffer.readUInt16LE(index) + amount, 0xffff), index);
    }

    return buffer;
  }
}
