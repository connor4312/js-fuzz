import { injectable } from "inversify";
import { IMutationAlgorithm } from ".";
import { randn } from "../../Math";
import { dupe } from "./util";

@injectable()
export class SwapByteMutator implements IMutationAlgorithm {
  public mutate(buffer: Buffer) {
    if (buffer.length < 2) {
      return null;
    }

    const src = randn(buffer.length);
    let dst = randn(buffer.length);
    while (dst === src) {
      dst = randn(buffer.length);
    }

    buffer = dupe(buffer);
    [buffer[src], buffer[dst]] = [buffer[dst], buffer[src]];
    return buffer;
  }
}
