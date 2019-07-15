import { FileSerializer } from "./Serializer";
import { IClusterOptions, Cluster } from "./Cluster";
import { hookRequire } from "./instrumentation/hook-manager";

/**
 * The Cluster coordinates multiple child
 */
export class ClusterFactory {
  private serializer = new FileSerializer();

  constructor(private readonly options: IClusterOptions) {}

  /**
   * Boots the cluster.
   */
  public start() {
    this.verifyModuleLooksCorrect();
    const cluster = new Cluster(this.options, this.serializer);
    setTimeout(() => cluster.start(), 0);
    return cluster;
  }

  /**
   * Does a quick smoke test to see if the module looks like it's set up
   * correctly to fuzz, throwing an error if it isn't.
   */
  private verifyModuleLooksCorrect() {
    const unhook = hookRequire(
      ()
    )
    const target = require(this.options.target); // tslint:disable-line
    if (!target || typeof target.fuzz !== 'function') {
      throw new Error("Expected the file to export a fuzz() function, but it didn't!");
    }
  }
}
