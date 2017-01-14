import * as cp from 'child_process';
import { randomBytes } from 'crypto';
import { EventEmitter } from 'events';

import { ICompletedWork, IDoWork, IModule, ipcCall } from './IPCCalls';

/**
 * The Manager lives inside the Cluster and manages events for a single
 * fuzzing worker instance.
 *
 * This uses Node's native IPC and encodes messages via JSON. Since a good
 * chunk of what we're sending is binary data, I thought that using a binary
 * protocol (protobufs) would be faster, but it turned out that it ran
 * at 75% of the speed of the JSON version (using childrens' stdin/out).
 *
 * Moral of the story: V8's JSON implementation is a beast,
 * beating it is not easy.
 */
class Manager extends EventEmitter {

  constructor(private proc: cp.ChildProcess) {
    super();

    proc.on('message', (msg: ipcCall) => {
      switch (msg.kind) {
      case 'ready':
        this.emit('ready');
        break;
      case 'completedWork':
        this.emit('completedWork', msg);
        break;
      default:
        throw new Error(`Unknown IPC call: ${msg.kind}`);
      }
    });

    proc.on('error', err => {
      this.emit('error', err);
    });

    proc.on('exit', code => {
      if (code !== 0) {
        this.emit('error', new Error(`Worker process exited with error code ${code}`));
      }

      this.emit('close');
    });
  }

  public send(work: Buffer) {
    const packet: IDoWork = {
      kind: 'doWork',
      input: work.toString('utf8'),
    };
    this.proc.send(packet);
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
    return new Promise((resolve, reject) => {
      const worker = new Manager(
        cp.fork(
          `${__dirname}/Worker.js`,
          [target, JSON.stringify(exclude)],
        ),
      );
      worker.once('ready', () => resolve(worker));
      worker.once('error', err => reject(err));
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
}

/**
 * The Cluster coordinates multiple child
 */
export class Cluster extends EventEmitter {

  private workers: Manager[] = [];

  // Crude collection of stats, to be filled out more nicely later ;)
  private totalCalls = 0;
  private calls = 0;

  constructor(private options: IClusterOptions) {
    super();

    setInterval(() => {
      this.emit('info', `Fuzzing w/ ${this.options.workers} slaves, ${this.totalCalls} execs (${this.calls} calls/sec)`);
      this.calls = 0;
    }, 1000);
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
      todo.push(Manager.Spawn(this.options.target, this.options.exclude));
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
      this.ingestCompletedWork(lastWork, result);
      sendNextPacket();
    });

    worker.on('error', err => {
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

  private ingestCompletedWork(work: Buffer, result: ICompletedWork) {
    this.totalCalls += 1;
    this.calls += 1;
  }

  private generateNextFuzz(): Buffer {
    return randomBytes(32);
  }
}
