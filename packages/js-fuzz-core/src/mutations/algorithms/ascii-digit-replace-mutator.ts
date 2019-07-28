import { injectable } from "inversify";
import { IMutationAlgorithm } from ".";
import { randn, pickOne } from "../../Math";
import { dupe, CharCodes } from "./util";

@injectable()
export class AsciiDigitReplaceMutator implements IMutationAlgorithm {
  public mutate(buffer: Buffer) {
    const digitPositions: number[] = [];
    for (let i = 0; i < buffer.length; i += 1) {
      if (buffer[i] >= CharCodes.Zero && buffer[i] <= CharCodes.Nine) {
        digitPositions.push(i);
      }
    }

    if (digitPositions.length === 0) {
      return null;
    }

    buffer = dupe(buffer);
    buffer[pickOne(digitPositions)] = randn(10) + CharCodes.Zero;
    return buffer;
  }
}
