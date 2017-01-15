import * as cp from 'child_process';
import { randomBytes } from 'crypto';
import { EventEmitter } from 'events';

import { HashStore } from './HashStore';
import {
  ICompletedWork,
  IModule,
  ipcCall,
  PacketKind,
  Protocol,
} from './Protocol';
import { BlessedRenderer, Stats } from './Stats';

/**
 * The Manager lives inside the Cluster and manages events for a single
 * fuzzing worker instance.
 */
class Manager extends EventEmitter {

  constructor(private proc: cp.ChildProcess, private proto: Protocol) {
    super();

    proc.stderr.pipe(process.stderr);
    proto.attach(proc.stdout, proc.stdin);

    proto.on('message', (msg: ipcCall) => {
      switch (msg.kind) {
      case PacketKind.Ready:
        this.emit('ready');
        break;
      case PacketKind.CompletedWork:
        this.emit('completedWork', msg);
        break;
      default:
        throw new Error(`Unknown IPC call: ${msg.kind}`);
      }
    });

    proto.on('error', (err: Error) => this.emit('error', err));
    proc.on('error', err => this.emit('error', err));

    proc.on('exit', code => {
      if (code !== 0) {
        this.emit('error', new Error(`Worker process exited with error code ${code}`));
      }

      this.emit('close');
    });
  }

  public send(work: Buffer) {
    this.proto.write({
      kind: PacketKind.DoWork,
      input: work,
    });
  }

  /**
   * Kills the underlying process.
   */
  public kill(signal?: string) {
    this.proc.kill(signal);
  }

  /**
   * Creates a new Worker instance and returns a promise that resolves
   * when it has signaled it's ready.
   */
  public static Spawn(target: string, exclude: string[]): Promise<Manager> {
    return new Promise<Manager>((resolve, reject) => {
      const worker = new Manager(
        cp.spawn('node', [
          `${__dirname}/Worker.js`,
          target,
          JSON.stringify(exclude),
        ]),
        new Protocol(require('./fuzz')),
      );
      worker.once('ready', () => resolve(worker));
      worker.once('error', (err: Error) => reject(err));
    });
  }
}

/**
 * Options passed in to instantiate the cluster.
 */
export interface IClusterOptions {
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
   * If set to true, stats will not be drawn and the process will not print anything.
   */
  quiet: boolean;
}

/**
 * The Cluster coordinates multiple child
 */
export class Cluster extends EventEmitter {

  private workers: Manager[] = [];
  private stats = new Stats();
  private store = new HashStore();

  constructor(private options: IClusterOptions) {
    super();

    this.stats.setWorkerProcesses(options.workers);
    if (!options.quiet) {
      new BlessedRenderer().attach(this.stats);
    }

    this.on('info', (message: string) => this.stats.log(message));
    this.on('warn', (message: string) => this.stats.log(message));
    this.on('error', (message: string) => this.stats.log(message));
  }

  /**
   * Boots the cluster.
   */
  public start() {
    if (!this.verifyModuleLooksCorrect()) {
      return;
    }

    this.emit('info', `Spinning up ${this.options.workers} workers`);

    const todo = [];
    for (let i = 0; i < this.options.workers; i += 1) {
      todo.push(Manager.Spawn(
        this.options.target,
        this.options.exclude,
      ));
    }

    Promise.all(todo)
      .then(workers => {
        this.workers = workers;
        workers.forEach((worker, i) => this.monitorWorker(worker, i));
        this.emit('info', `Workers ready, initializing fuzzing...`);
      });
  }

  /**
   * Does a quick smoke test to see if the module looks like it's set up
   * correctly to fuzz, emitting an error and returning false if it isn't.
   */
  private verifyModuleLooksCorrect(): boolean {
    let target: IModule;
    try {
      target = require(this.options.target); // tslint:disable-line
    } catch (e) {
      this.emit('error', e);
      return false;
    }

    if (!target || typeof target.fuzz !== 'function') {
      this.emit('error', new Error('Expected the file to export a fuzz() function, but it didn\'t!'));
      return false;
    }

    return true;
  }

  /**
   * Hooks into events on the worker and reboots it if it dies.
   */
  private monitorWorker(worker: Manager, index: number) {
    let lastWork: Buffer;
    const sendNextPacket = () => {
      lastWork = this.generateNextFuzz();
      worker.send(lastWork);
    };

    worker.on('completedWork', (result: ICompletedWork) => {
      this.ingestCompletedWork(lastWork, result, index);
      sendNextPacket();
    });

    worker.on('error', (err: Error) => {
      this.emit('warn', `Worker ${index} crashed with error: ${err.stack || err}`);
      worker.kill();
      worker.removeAllListeners();
      Manager.Spawn(this.options.target, this.options.exclude).then(next => {
        this.workers[index] = next;
        this.monitorWorker(next, index);
      });
    });

    sendNextPacket();
  }

  private ingestCompletedWork(work: Buffer, result: ICompletedWork, worker: number) {
    this.store.putIfNotExistent(result.coverage);
    this.stats.recordExec(worker);
    this.stats.recordCoverageBranches(this.store.size());
  }

  private generateNextFuzz(): Buffer {
    return randomBytes(32);
  }
}
