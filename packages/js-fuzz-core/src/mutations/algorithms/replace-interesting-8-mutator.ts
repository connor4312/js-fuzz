import { injectable } from "inversify";
import { IMutationAlgorithm } from ".";
import { randn, pickOne } from "../../Math";
import { dupe } from "./util";
import { interesting8Bits } from "../interesting-bits";

@injectable()
export class ReplaceInteresting8Mutator implements IMutationAlgorithm {
  public mutate(buffer: Buffer) {
    if (buffer.length === 0) {
      return null;
    }

    buffer = dupe(buffer);
    buffer[randn(buffer.length)] = pickOne(interesting8Bits)[0];
    return buffer;
  }
}
