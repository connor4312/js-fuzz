import { injectable } from "inversify";
import { IMutationAlgorithm } from ".";
import { randn } from "../../Math";
import { chooseLength } from "./util";
import { randomBytes } from "crypto";

@injectable()
export class InsertRangeMutator implements IMutationAlgorithm {
  public mutate(buffer: Buffer) {
    const start = randn(buffer.length + 1);

    return Buffer.concat([
      buffer.slice(0, start),
      randomBytes(chooseLength(10)),
      buffer.slice(start),
    ]);
  }
}
