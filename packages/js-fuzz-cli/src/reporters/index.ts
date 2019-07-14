import { Stat } from "js-fuzz-core";
import { JsonReporter } from "./json";

/**
 * Type that prettifies output information for the console.
 */
export interface IReporter {
  /**
   * Updates stats information from the fuzzer.
   */
  write(stats: Stat): void;

  /**
   * Shuts down the reporter.
   */
  close(): void;
}

export enum ReporterType {
  Json = 'json',
}

export const reporters: { [K in ReporterType]: () => IReporter } = {
  json: () => new JsonReporter(),
}
