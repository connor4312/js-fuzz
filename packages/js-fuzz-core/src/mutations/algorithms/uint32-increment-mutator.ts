import { injectable } from "inversify";
import { IMutationAlgorithm } from ".";
import { randn } from "../../Math";
import { dupe, roughWrap } from "./util";

@injectable()
export class Uint32IncrementMutator implements IMutationAlgorithm {
  public mutate(buffer: Buffer) {
    if (buffer.length < 4) {
      return null;
    }

    const index = randn(buffer.length - 4);
    const amount = Math.random() > 0.5 ? 1 : -1;
    buffer = dupe(buffer);
    if (Math.random() > 0.5) {
      buffer.writeUInt32BE(roughWrap(buffer.readUInt32BE(index) + amount, 0xffffffff), index);
    } else {
      buffer.writeUInt32LE(roughWrap(buffer.readUInt32LE(index) + amount, 0xffffffff), index);
    }

    return buffer;
  }
}
