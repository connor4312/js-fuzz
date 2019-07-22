import * as cp from 'child_process';
import { EventEmitter } from 'events';
import { Subject, Observable } from 'rxjs';

import { Corpus, Input } from './Corpus';
import { IPCCall, IWorkSummary, PacketKind, Protocol } from './Protocol';
import { ISerializer } from './Serializer';
import { Stat, StatType } from './Stats';
import { IFuzzOptions } from './options';

const split = require('split');

interface IManagerOptions {
  timeout: number;
  exclude: string[];
}

/**
 * The Manager lives inside the Cluster and manages events for a single
 * fuzzing worker instance.
 */
class Manager extends EventEmitter {
  private timeoutHandle!: NodeJS.Timer;

  constructor(
    private readonly proc: cp.ChildProcess,
    private readonly proto: Protocol,
    private readonly options: IManagerOptions,
    private readonly corpus: Corpus,
  ) {
    super();

    proc.stderr.pipe(split()).on('data', (message: string) => this.emit('log', message));

    proto.attach(proc.stdout, proc.stdin);

    proto.on('message', (msg: IPCCall) => {
      switch (msg.kind) {
        case PacketKind.Ready:
          this.emit('ready');
          break;
        case PacketKind.WorkSummary:
          this.clearTimeout();
          this.emit('workSummary', msg);
          break;
        case PacketKind.WorkCoverage:
          this.emit('workCoverage', msg.coverage);
          break;
        case PacketKind.FoundLiterals:
          this.corpus.foundLiterals(msg.literals);
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

  /**
   * Sends new work to the working process.
   */
  public send(work: Buffer) {
    this.setTimeout();
    this.proto.write({
      kind: PacketKind.DoWork,
      input: work,
    });
  }

  /**
   * Sends new work to the working process.
   */
  public requestCoverage(callback: (coverage: Buffer) => void) {
    this.proto.write({ kind: PacketKind.RequestCoverage });
    this.once('workCoverage', callback);
  }

  /**
   * Kills the underlying process and returns a promise that's resolved
   * when the process exits. The process will be forcefully terminated
   * if it does not terminate within the given interval.
   */
  public kill(timeout: number = 2000): Promise<void> {
    this.clearTimeout();
    this.proc.kill('SIGINT');

    // Ask the process politely to shut down, send SIGKILL if it doesn't
    // clean up in a few seconds. This can happen if the event loop is
    // blocked and someone was naughty and registered a SIGINT handler.
    const killTimeout = setTimeout(() => this.proc.kill('SIGKILL'), timeout);
    this.proc.removeAllListeners('error');
    this.removeAllListeners('error');
    this.on('error', () => {
      /* noop */
    });
    this.proc.kill();

    return new Promise<void>(resolve => {
      this.proc.once('exit', () => {
        clearTimeout(killTimeout);
        this.emit('close');
        resolve();
      });
    });
  }

  private clearTimeout() {
    clearTimeout(this.timeoutHandle);
  }

  private setTimeout() {
    this.timeoutHandle = setTimeout(() => {
      this.emit('timeout');
      this.kill();
    }, this.options.timeout);
  }

  /**
   * Creates a new Worker instance and returns a promise that resolves
   * when it has signaled it's ready.
   */
  public static Spawn(target: string, corpus: Corpus, options: IManagerOptions): Promise<Manager> {
    return new Promise<Manager>((resolve, reject) => {
      const worker = new Manager(
        cp.spawn('node', [`${__dirname}/Worker.js`, target, JSON.stringify(options.exclude)]),
        new Protocol(require('./fuzz')),
        options,
        corpus,
      );
      worker.once('ready', () => resolve(worker));
      worker.once('error', (err: Error) => reject(err));
    });
  }
}
/**
 * The Cluster coordinates multiple child
 */
export class Cluster {
  private workers: Manager[] = [];
  private corpus!: Corpus;
  private active = true;
  private statsSubject = new Subject<Stat>();

  public get stats(): Observable<Stat> {
    return this.statsSubject;
  }

  constructor(private readonly options: IFuzzOptions, private readonly serializer: ISerializer) {
    this.start();
  }

  /**
   * Emits the given stat to the output stream.
   */
  private emitStat(stat: Stat) {
    this.statsSubject.next(stat);
  }

  /**
   * Emits the fatal error to the output stream.
   */
  private emitFatalError(error: Error | string) {
    if (typeof error === 'string') {
      error = new Error(error);
    }

    this.emitStat({
      type: StatType.FatalError,
      details: error.stack || error.message,
      error: error,
    });
  }

  /**
   * Boots the cluster.
   */
  public start() {
    this.serializer
      .loadCorpus()
      .then(corpus => {
        this.corpus = corpus;
        this.emitStat({ type: StatType.SpinUp, workerCount: this.options.workers });

        const todo: Promise<Manager>[] = [];
        for (let i = 0; i < this.options.workers; i += 1) {
          todo.push(this.spawn());
        }

        return Promise.all(todo);
      })
      .then(workers => {
        this.workers = workers;
        workers.forEach((worker, i) => this.monitorWorker(worker, i));
        this.emitStat({ type: StatType.WorkersReady });
      })
      .catch(err => this.emitFatalError(err));
  }

  /**
   * Stops the server.
   */
  public shutdown(signal: string) {
    this.emitStat({ type: StatType.ShutdownStart, signal });
    this.active = false;

    Promise.all(
      this.workers
        .filter(Boolean)
        .map(worker => worker.kill())
        .concat(this.serializer.storeCorpus(this.corpus)),
    )
      .then(() => this.emitStat({ type: StatType.ShutdownComplete }))
      .catch(e => this.emitFatalError(e));
  }

  private spawn(): Promise<Manager> {
    return Manager.Spawn(this.options.target, this.corpus, {
      exclude: this.options.exclude,
      timeout: this.options.timeout,
    });
  }

  /**
   * Hooks into events on the worker and reboots it if it dies.
   */
  private monitorWorker(worker: Manager, index: number) {
    let lastInput: Input;
    let lastWork: Buffer;
    const sendNextPacket = () => {
      lastInput = this.corpus.pickWeighted();
      lastWork = this.corpus.mutate(lastInput);
      worker.send(lastWork);
    };

    worker.on('log', (line: string) => {
      this.emitStat({ type: StatType.ProgramLogLine, worker: index, line });
    });

    worker.on('timeout', () => {
      this.serializer.storeTimeout(lastWork);
      this.emitStat({ type: StatType.WorkerTimeout, worker: index });
    });

    worker.on('workSummary', (result: IWorkSummary) => {
      if (!this.active) {
        return;
      }

      const next = new Input(lastWork, lastInput.depth + 1, result);
      this.emitStat({ type: StatType.WorkerExecuted, summary: result });
      if (!this.corpus.isInterestedIn(next)) {
        return sendNextPacket();
      }

      worker.requestCoverage(() => {
        if (!this.active) {
          return;
        }

        this.corpus.put(next);
        this.emitStat({ type: StatType.CoverageUpdate, branches: this.corpus.size() });
        if (result.error) {
          this.serializer.storeCrasher(next);
        }

        sendNextPacket();
      });
    });

    worker.once('error', (err: Error) => {
      if (!this.active) {
        return;
      }

      this.emitStat({ type: StatType.WorkerErrored, error: err, worker: index });
      worker.kill();
      this.spawn().then(next => {
        this.workers[index] = next;
        this.monitorWorker(next, index);
      });
    });

    sendNextPacket();
  }
}
