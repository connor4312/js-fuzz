import * as clone from 'clone';
import { IModule, ipcCall, WorkResult } from './IPCCalls';

import istanbul = require('istanbul');

/**
 * Subset of istanbul's coverage output. There's DT typings for Istanbul but
 * they're basically a shell.
 */
interface ICoverage {
  branches: {
    total: number;
    covered: number;
    skipped: number;
    pct: number;
  };
}

declare var __coverage__: ICoverage;

/**
 * The worker is attached to a Cluster and runs the target script when the
 * manager asks for it, reporting back code coverage metrics.
 */
export class Worker {

  /**
   * The module to be put under fuzzing
   */
  private target: IModule;

  /**
   * The initial __coverage__ state, deep cloned, so that we can
   * restore it between tests.
   */
  private defaultCoverage: ICoverage;

  /**
   * List of modules to exclude from code coverage analysis.
   */
  private excludes: RegExp[] = [];

  constructor(private targetPath: string, exclude: string[]) {
    this.excludes = exclude.map(e => new RegExp(e));
  }

  public start() {
    const instrumenter = new istanbul.Instrumenter();
    istanbul.hook.hookRequire(
      file => !this.excludes.some(re => re.test(file)),
      (contents, file) => instrumenter.instrumentSync(contents, file),
    );

    this.target = require(this.targetPath); // tslint:disable-line
    this.defaultCoverage = clone(__coverage__);

    process.on('message', (msg: ipcCall) => {
      switch (msg.kind) {
      case 'doWork':
        this.doWork(msg.input);
        break;
      default:
        throw new Error(`Unknown IPC call: ${msg.kind}`);
      }
    });

    this.send({ kind: 'ready' });
  }

  private doWork(input: string): void {
    let result: WorkResult;
    try {
      result = this.target.fuzz(Buffer.from(input));
    } catch (e) {
      return this.send({
        kind: 'completedWork',
        result: WorkResult.Error,
        error: e.stack || e.message,
      });
    }

    const coverage: ICoverage =  istanbul.utils.summarizeCoverage(__coverage__);
    this.send({
      coverage: coverage.branches.pct,
      result,
      kind: 'completedWork',
    });
  }

  private send(result: ipcCall): void {
    process.send(result);
  }
}

if (require.main === module) {
  new Worker(process.argv[2], JSON.parse(process.argv[3])).start();
}
