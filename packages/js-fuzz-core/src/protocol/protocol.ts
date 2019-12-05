/**
 * TypeScript definitions for the protobuf. Full definitions with documentation
 * can be found in rpc.proto.
 */

export interface IEmptyMessage {}

export interface IConnectResponse {
  workerId: number;
  script: string;
  corpus: ICorpusEntry[];
}

export interface ICorpusEntry {
  input: Buffer;
  priority: number;
}

export interface IFoundInputRequest extends ICorpusEntry {
  workerId: number;
}

export interface IFoundCrasherRequest {
  workerId: number;
  input: Buffer;
  error: string;
}

export interface ISyncRequest {
  workerId: number;
  executions: number;
  coverage: number;
}

export interface ISyncResponse {
  corpus: ICorpusEntry[];
}

export interface ICoordinatorService {
  connect(message: IEmptyMessage): IConnectResponse;
  foundInput(message: IFoundInputRequest): IEmptyMessage;
  foundCrasher(message: IFoundCrasherRequest): IEmptyMessage;
  sync(message: ISyncRequest): ISyncResponse;
}
