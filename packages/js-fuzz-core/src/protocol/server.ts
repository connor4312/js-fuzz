import { Server as RawServer, ServerCredentials } from 'grpc';
import * as loader from '@grpc/proto-loader';
import { resolve } from 'path';
import { callbackify } from 'util';
import {
  ICoordinatorService,
  IConnectResponse,
  IEmptyMessage,
  ICorpusEntry,
  IFoundInputRequest,
  IFoundCrasherRequest,
  ISyncRequest,
  ISyncResponse,
} from './protocol';
import { inject, injectable } from 'inversify';
import { CrashersArtifactSet, CorpusArtifactSet } from '../dependencies';
import { IArtifactSet } from '../artifact-set';
import { interval, Observable } from 'rxjs';
import { exhaustMap } from 'rxjs/operators';

type FirstArgumentType<F extends Function> = F extends (args: infer A) => any ? A : never;

type RawRpcServices = {
  [K in keyof ICoordinatorService]: (
    fn: FirstArgumentType<ICoordinatorService[K]>,
    callback: (err: Error | null, result: ReturnType<ICoordinatorService[K]>) => void,
  ) => void
};

interface IWorker {
  id: number;
  pending: ICorpusEntry[];
}

interface ICorpusMetadata {
  priority: number;
}

interface ICrasherMetadata {
  error: string;
}

export interface IServerStats {
  /**
   * Time at which the last input data was discovered.
   */
  lastInput: number;

  /**
   * Time the system started.
   */
  startTime: number;

  /**
   * Number of branches covered.
   */
  coverage: number;

  /**
   * Number of executions we've made.
   */
  executions: number;

  /**
   * Number of crashers.
   */
  crashers: number;

  /**
   * Number of items in the corpus.
   */
  corpus: number;
}

/**
 * Server that runs on the coordinating process.
 */
@injectable()
export class GrpcServer {
  private idCounter = 0;
  private workers: IWorker[] = [];
  private lastStats = {
    lastInput: Date.now(),
    startTime: Date.now(),
    executions: 0,
    coverage: 0,
  };

  constructor(
    @inject(CrashersArtifactSet) private readonly crashers: IArtifactSet<ICrasherMetadata>,
    @inject(CorpusArtifactSet) private readonly corpus: IArtifactSet<ICorpusMetadata>,
  ) {}

  /**
   * Starts the server, and returns the port it's running on.
   */
  public async start() {
    const { rpc } = (await loader.load(resolve(__dirname, '..', '..', 'rpc.proto'), {
      keepCase: true,
      longs: String,
      enums: Number,
      defaults: false,
    })) as any;

    const services: RawRpcServices = {
      connect: callbackify(this.connect),
      foundInput: callbackify(this.foundInput),
      foundCrasher: callbackify(this.foundCrasher),
      sync: callbackify(this.sync),
    };

    const server = new RawServer();
    server.addService(rpc.Coordinator.service, services);
    const port = server.bind('localhost:0', ServerCredentials.createInsecure());
    server.start();
    return port;
  }

  /**
   * Returns stats periodically from the server.
   */
  public stats(): Observable<IServerStats> {
    return interval(1000).pipe(
      exhaustMap(async () => ({
        ...this.lastStats,
        crashers: await this.crashers.size(),
        corpus: await this.corpus.size(),
      })),
    );
  }

  private readonly connect = async (_: IEmptyMessage): Promise<IConnectResponse> => {
    const worker: IWorker = {
      id: this.idCounter++,
      pending: [],
    };

    this.workers.push(worker);

    return {
      workerId: worker.id,
      script: '',
      corpus: Object.values(await this.corpus.all()).map(v => ({
        input: v.data,
        priority: v.metadata.priority,
      })),
    };
  };

  private readonly sync = async (req: ISyncRequest): Promise<ISyncResponse> => {
    this.lastStats.coverage = Math.max(this.lastStats.coverage, req.coverage);
    this.lastStats.executions += req.executions;

    const worker = this.workers.find(w => w.id === req.workerId);
    if (!worker) {
      throw new Error('Worker with the given ID is unknown');
    }

    const pending = worker.pending;
    worker.pending = [];
    return { corpus: pending };
  };

  private readonly foundCrasher = async (req: IFoundCrasherRequest): Promise<IEmptyMessage> => {
    await this.crashers.add({
      data: req.input,
      metadata: { error: req.error },
      userGenerated: false,
    });

    return {};
  };

  private readonly foundInput = async (req: IFoundInputRequest): Promise<IEmptyMessage> => {
    const isNew = await this.corpus.add({
      data: req.input,
      metadata: { priority: req.priority },
      userGenerated: false,
    });

    if (!isNew) {
      return {};
    }

    const pendingItem = { input: req.input, priority: req.priority };
    for (const worker of this.workers) {
      if (worker.id !== req.workerId) {
        worker.pending.push(pendingItem);
      }
    }

    this.lastStats.lastInput = Date.now();

    return {};
  };
}
