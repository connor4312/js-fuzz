import { CoverageHash, ICoverageHash } from "./coverage-hash";
import { injectable, inject } from "inversify";
import * as Types from "../dependencies";

export interface IRuntimeServices {
  coverage: ICoverageHash;
}

/**
 * Collection of invokable runtime services.
 */
@injectable()
export class RuntimeServiceCollection implements IRuntimeServices {
  constructor(
    @inject(Types.CoverageHashService)
    public readonly coverage: CoverageHash
  ) {}

  public reset() {
    this.coverage.reset();
  }
}
