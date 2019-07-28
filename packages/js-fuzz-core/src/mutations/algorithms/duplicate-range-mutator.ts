import { injectable } from "inversify";
import { IMutationAlgorithm } from ".";
import { randn } from "../../Math";
import { chooseLength, dupe } from "./util";

@injectable()
export class DuplicateRangeMutator implements IMutationAlgorithm {
  public mutate(buffer: Buffer) {
    if (buffer.length < 2) {
      return null;
    }

    buffer = dupe(buffer);
    const src = randn(buffer.length);
    const len = chooseLength(buffer.length - src);
    let dst = randn(buffer.length);
    while (dst === src) {
      dst = randn(buffer.length);
    }

    return Buffer.concat([buffer.slice(0, src + len), buffer.slice(src, len), buffer.slice(dst)]);
  }
}
