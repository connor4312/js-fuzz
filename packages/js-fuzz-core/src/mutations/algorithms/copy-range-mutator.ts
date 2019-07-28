import { injectable } from "inversify";
import { IMutationAlgorithm } from ".";
import { randn } from "../../Math";
import { chooseLength, dupe } from "./util";

@injectable()
export class CopyRangeMutator implements IMutationAlgorithm {
  public mutate(buffer: Buffer) {
    if (buffer.length < 2) {
      return null;
    }

    const src = randn(buffer.length);
    const len = chooseLength(buffer.length - src);
    let dst = randn(buffer.length);
    while (dst === src) {
      dst = randn(buffer.length);
    }

    buffer = dupe(buffer);
    buffer.copy(buffer, dst, src, len);
    return buffer;
  }
}
