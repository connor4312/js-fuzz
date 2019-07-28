import { injectable } from "inversify";
import { IMutationAlgorithm } from ".";
import { randn } from "../../Math";
import { dupe } from "./util";

@injectable()
export class FlipBitMutator implements IMutationAlgorithm {
  public mutate(buffer: Buffer) {
    if (buffer.length < 1) {
      return null;
    }

    buffer = dupe(buffer);
    buffer[randn(buffer.length)] ^= 1 << randn(8);
    return buffer;
  }
}
