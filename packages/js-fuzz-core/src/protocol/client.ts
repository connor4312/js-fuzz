import {
  IConnectResponse,
  ICoordinatorService,
  IFoundInputRequest,
  IFoundCrasherRequest,
  ISyncRequest,
} from './protocol';
import * as loader from '@grpc/proto-loader';
import { ServerCredentials } from 'grpc';
import { promisify } from 'util';
import { resolve } from 'path';

type FirstArgumentType<F extends Function> = F extends (args: infer A) => any ? A : never;

type PromisifiedClient = {
  [K in keyof ICoordinatorService]: (
    fn: FirstArgumentType<ICoordinatorService[K]>,
  ) => Promise<ReturnType<ICoordinatorService[K]>>
};

/**
 * Client to connect to the coordinating server. Full definitions with
 * documentation can be found in rpc.proto.
 */
export class Client {
  private client?: Promise<PromisifiedClient>;
  private workerId?: number;

  constructor(private readonly port: number) {}

  public async connect(): Promise<IConnectResponse> {
    const client = await this.getClient();
    const res = await client.connect({});
    this.workerId = res.workerId;
    return res;
  }

  public async foundInput(message: Omit<IFoundInputRequest, 'workerId'>): Promise<void> {
    const client = await this.getClient();
    await client.foundInput({ ...message, workerId: this.mustGetWorkerId() });
  }

  public async foundCrasher(message: Omit<IFoundCrasherRequest, 'workerId'>): Promise<void> {
    const client = await this.getClient();
    await client.foundCrasher({ ...message, workerId: this.mustGetWorkerId() });
  }

  public async sync(message: Omit<ISyncRequest, 'workerId'>): Promise<void> {
    const client = await this.getClient();
    await client.sync({ ...message, workerId: this.mustGetWorkerId() });
  }

  private mustGetWorkerId() {
    if (!this.workerId) {
      throw new Error('Client must call connect() before calling other methods');
    }

    return this.workerId;
  }

  private getClient() {
    return (this.client =
      this.client ||
      (async () => {
        const { rpc } = (await loader.load(resolve(__dirname, '..', '..', 'rpc.proto'), {
          keepCase: true,
          longs: String,
          enums: Number,
          defaults: false,
        })) as any;

        const rawClient = new rpc.Coordinator(
          `localhost:${this.port}`,
          ServerCredentials.createInsecure(),
        );
        return {
          connect: promisify(rawClient.connect.bind(rawClient)),
          foundInput: promisify(rawClient.foundInput.bind(rawClient)),
          foundCrasher: promisify(rawClient.foundCrasher.bind(rawClient)),
          sync: promisify(rawClient.sync.bind(rawClient)),
        } as PromisifiedClient;
      })());
  }
}
