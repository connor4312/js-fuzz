/**
 * IModule is the module type we expect to be passed to
 */
export interface IModule {
  fuzz(input: Buffer): WorkResult;
}

export interface IReadyCall {
  kind: 'ready';
}

export enum WorkResult {
  Ignore,
  Allow,
  Reinforce,
  Error,
}

export interface ICompletedWork {
  kind: 'completedWork';
  result: WorkResult;
  error?: string;
  coverage?: number;
}

export interface IDoWork {
  kind: 'doWork';
  input: string; // todo, some kind of better binary rep?
}

export type ipcCall = ICompletedWork | IDoWork | IReadyCall;
