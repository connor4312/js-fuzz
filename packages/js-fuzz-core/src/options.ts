import { IInstrumenterOptions } from "./instrumentation/coverage-instrumentor";

/**
 * Options passed in to instantiate the cluster.
 */
export interface IFuzzOptions {
  /**
   * The number of worker processes to create.
   */
  workers: number;

  /**
   * Absolute path to the target script to generate coverage on.
   */
  target: string;

  /**
   * Patterns for files or modules which should be excluded from coverage.
   */
  exclude: string[];

  /**
   * Length of time we kill worker processes after, given in milliseconds, if
   * they don't produce results.
   */
  timeout: number;

  /**
   * Instrumentation options.
   */
  instrumentor?: Partial<IInstrumenterOptions>;
}
