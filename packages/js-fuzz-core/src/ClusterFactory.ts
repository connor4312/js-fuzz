import { FileSerializer } from "./Serializer";
import { IClusterOptions, Cluster } from "./Cluster";

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
    return new Cluster(this.options, this.serializer);
  }

  /**
   * Does a quick smoke test to see if the module looks like it's set up
   * correctly to fuzz, throwing an error if it isn't.
   */
  private verifyModuleLooksCorrect() {
    const target = require(this.options.target); // tslint:disable-line
    if (!target || typeof target.fuzz !== 'function') {
      throw new Error("Expected the file to export a fuzz() function, but it didn't!");
    }
  }
}
