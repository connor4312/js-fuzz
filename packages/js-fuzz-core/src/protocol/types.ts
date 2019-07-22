/**
 * Type delimiter for IPCCalls.
 */
export enum PacketKind {
  Ready,
  WorkSummary,
  RequestCoverage,
  WorkCoverage,
  DoWork,
  FoundLiterals,
}

/**
 * An IReady message is sent from workers when their code is loaded and ready to go.
 */
export interface IReadyCall {
  kind: PacketKind.Ready;
}

export enum WorkResult {
  Ignore,
  Allow,
  Reinforce,
  Error,
}

/**
 * An IRequestCoverage is sent from the master to the slave if the work
 * resulted in something that looks interesting.
 */
export interface IRequestCoverage {
  kind: PacketKind.RequestCoverage;
}

/**
 * A WorkSummary is sent from the slave to the master when work is completed.
 */
export interface IWorkSummary {
  kind: PacketKind.WorkSummary;
  result: WorkResult;
  coverageSize: number;
  inputLength: number;
  hash: string;
  runtime: number; // given in microseconds
  error?: string;
}

/**
 * An IWorkCoverage is sent in response to an IRequestCoverage message.
 */
export interface IWorkCoverage {
  kind: PacketKind.WorkCoverage;
  coverage: Buffer;
}

/**
 * IDoWork is sent to signal a slave that we want to fuzz the given input.
 */
export interface IDoWork {
  kind: PacketKind.DoWork;
  input: Buffer;
}

export type IPCCall =
  | IWorkSummary
  | IDoWork
  | IReadyCall
  | IWorkCoverage
  | IRequestCoverage;
