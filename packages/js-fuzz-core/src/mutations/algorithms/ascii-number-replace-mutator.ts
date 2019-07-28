import { injectable } from "inversify";
import { IMutationAlgorithm } from ".";
import { randn, pickOne, maxInt32 } from "../../Math";
import { CharCodes } from "./util";

@injectable()
export class AsciiNumberReplaceMutator implements IMutationAlgorithm {
  public mutate(buffer: Buffer) {
    const numberPositions: { start: number; end: number }[] = [];
    let start = -1;
    for (let i = 0; i < buffer.length; i += 1) {
      if (
        (buffer[i] >= CharCodes.Zero && buffer[i] <= CharCodes.Nine) ||
        (start === -1 && buffer[i] === CharCodes.Dash)
      ) {
        if (start === -1) {
          start = i;
        }
      } else if (start !== -1 && i - start > 1) {
        numberPositions.push({ start, end: i });
        start = -1;
      }
    }

    if (start > 0 && start < buffer.length - 1) {
      numberPositions.push({ start, end: buffer.length });
    }

    if (numberPositions.length === 0) {
      return null;
    }

    let value: number;
    switch (randn(4)) {
      case 0:
        value = randn(1000);
        break;
      case 1:
        value = randn(maxInt32);
        break;
      case 2:
        value = randn(maxInt32) ** 2;
        break;
      case 3:
        value = -randn(maxInt32);
        break;
      default:
        throw new Error('unreachable');
    }

    const toReplace = pickOne(numberPositions);
    if (buffer[toReplace.start] === CharCodes.Dash) {
      value *= -1;
    }

    return Buffer.concat([
      buffer.slice(0, toReplace.start),
      Buffer.from(value.toString()),
      buffer.slice(toReplace.end),
    ]);
  }
}
