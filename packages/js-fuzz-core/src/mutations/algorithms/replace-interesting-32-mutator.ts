import { injectable } from "inversify";
import { IMutationAlgorithm } from ".";
import { randn, pickOne } from "../../Math";
import { dupe } from "./util";
import { interesting32Bits } from "../interesting-bits";

@injectable()
export class ReplaceInteresting32Mutator implements IMutationAlgorithm {
  public mutate(buffer: Buffer) {
    if (buffer.length < 4) {
      return null;
    }

    buffer = dupe(buffer);
    pickOne(interesting32Bits).copy(buffer, randn(buffer.length - 3));
    return buffer;
  }
}
