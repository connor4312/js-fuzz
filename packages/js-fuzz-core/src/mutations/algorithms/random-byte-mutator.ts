import { injectable } from "inversify";
import { IMutationAlgorithm } from ".";
import { randn } from "../../Math";
import { dupe } from "./util";

@injectable()
export class RandomByteMutator implements IMutationAlgorithm {
  public mutate(buffer: Buffer) {
    if (buffer.length < 1) {
      return null;
    }

    buffer = dupe(buffer);
    buffer[randn(buffer.length)] ^= randn(255) + 1;
    return buffer;
  }
}
