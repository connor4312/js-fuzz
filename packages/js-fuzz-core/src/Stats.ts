import { IWorkSummary } from './Protocol';

export const enum StatType {
  FatalError = 'fatalError',
  SpinUp = 'spinUp',
  WorkersReady = 'workersReady',
  ProgramLogLine = 'programLogLine',
  ShutdownStart = 'shutdownStart',
  ShutdownComplete = 'shutdownComplete',
  WorkerTimeout = 'workerTimeout',
  WorkerExecuted = 'workerExecuted',
  WorkerErrored = 'workerErrored',
  CoverageUpdate = 'coverageUpdate',
}

/**
 * Indicates a fatal error occurred that prevents us from proceeding further.
 */
export interface IFatalError {
  type: StatType.FatalError;
  error?: Error;
  details: string;
}

/**
 * Indicates that the cluster is spinning up.
 */
export interface ISpinUp {
  type: StatType.SpinUp;
  workerCount: number;
}

/**
 * Indicates that all workers are ready for fuzzing.
 */
export interface IWorkersReady {
  type: StatType.WorkersReady;
}

/**
 * Indicates that a shutdown signal was received.
 */
export interface IShutdownStart {
  type: StatType.ShutdownStart;
  signal?: string;
}

/**
 * Indicates that all workers and resources have shut down.
 */
export interface IShutdownComplete {
  type: StatType.ShutdownComplete;
}

/**
 * Indicates that a worker timed out while executing.
 */
export interface IWorkerTimeout {
  type: StatType.WorkerTimeout;
  worker: number;
}

/**
 * Indicates that a worker completed work on a given input.
 */
export interface IWorkerExecuted {
  type: StatType.WorkerExecuted;
  summary: IWorkSummary;
}

/**
 * Indicates that a worker errored or crashed. This is _not_ expected.
 */
export interface IWorkerUnhandledError {
  type: StatType.WorkerErrored;
  worker: number;
  error: Error;
}

/**
 * Emitted when we update our coverage count
 */
export interface ICoverageUpdate {
  type: StatType.CoverageUpdate;
  branches: number;
}

/**
 * Emitted when the user program writes a log message.
 */
export interface IProgramLogLine {
  type: StatType.ProgramLogLine;
  worker: number;
  line: string;
}

/**
 * Type emitted from the Cluster when it has information to report.
 */
export type Stat =
  | IFatalError
  | ISpinUp
  | IWorkersReady
  | IShutdownStart
  | IShutdownComplete
  | IProgramLogLine
  | ICoverageUpdate
  | IWorkerUnhandledError
  | IWorkerExecuted
  | IWorkerTimeout;
