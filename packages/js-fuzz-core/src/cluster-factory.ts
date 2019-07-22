import { FileSerializer } from "./Serializer";
import { IClusterOptions, Cluster } from "./Cluster";
import { injectable, inject } from "inversify";
import * as Types from "./dependencies";
import { LiteralExtractor } from "./instrumentation/literal-extractor";

/**
 * The Cluster coordinates multiple child
 */
@injectable()
export class ClusterFactory {
  private serializer = new FileSerializer();

  constructor(
    private readonly options: IClusterOptions,
    @inject(Types.LiteralExtractor)
    private readonly literalExtractor: LiteralExtractor
  ) {}

  /**
   * Boots the cluster.
   */
  public start() {
    this.seedAndValidateModules();
    const cluster = new Cluster(this.options, this.serializer);
    setTimeout(() => cluster.start(), 0);
    return cluster;
  }

  /**
   * Does a quick smoke test to see if the module looks like it's set up
   * correctly to fuzz, throwing an error if it isn't.
   */
  private async seedAndValidateModules() {
    const literals = await this.literalExtractor.detectAll(async () => {
      const target = require(this.options.target); // tslint:disable-line
      if (!target || typeof target.fuzz !== 'function') {
        throw new Error("Expected the file to export a fuzz() function, but it didn't!");
      }

      try {
        await target(Buffer.alloc(0));
      } catch {
        // ignore any errors, we'll catch them in fuzzing, we just want to make
        // sure that any dynamic imports run.
      }
    });


  }
}
