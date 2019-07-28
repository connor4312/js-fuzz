import { injectable } from "inversify";
import { IMutationAlgorithm } from ".";
import { randn } from "../../Math";
import { chooseLength } from "./util";

@injectable()
export class RemoveRangeMutator implements IMutationAlgorithm {
  public mutate(buffer: Buffer) {
    if (buffer.length < 1) {
      return null;
    }

    const start = randn(buffer.length);
    const end = start + chooseLength(buffer.length - start);
    return Buffer.concat([buffer.slice(0, start), buffer.slice(end)]);
  }
}
