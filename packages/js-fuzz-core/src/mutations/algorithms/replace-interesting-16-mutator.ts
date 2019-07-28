import { injectable } from "inversify";
import { IMutationAlgorithm } from ".";
import { randn, pickOne } from "../../Math";
import { dupe } from "./util";
import { interesting16Bits } from "../interesting-bits";

@injectable()
export class ReplaceInteresting16Mutator implements IMutationAlgorithm {
  public mutate(buffer: Buffer) {
    if (buffer.length < 2) {
      return null;
    }

    buffer = dupe(buffer);
    pickOne(interesting16Bits).copy(buffer, randn(buffer.length - 1), 0, 2);
    return buffer;
  }
}
