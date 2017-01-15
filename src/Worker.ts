import { hookRequire, Instrumenter } from './Instrumenter';
import { IModule, ipcCall, WorkResult } from './IPCCalls';
import { roundUint8ToNextPowerOfTwo } from './Math';

/**
 * Evens off the statement count in the coverage into count "buckets".
 */
function flattenBuckets(coverage: Buffer): Buffer {
  for (let i = 0; i < coverage.length; i += 1) {
    coverage[i] = roundUint8ToNextPowerOfTwo(coverage[i]);
  }
  return coverage;
}

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
   * List of modules to exclude from code coverage analysis.
   */
  private excludes: RegExp[] = [];

  /**
   * Instrumenter used for the worker code's code.
   */
  private instrumenter: Instrumenter;

  constructor(private targetPath: string, exclude: string[]) {
    this.excludes = exclude.map(e => new RegExp(e));
  }

  public start() {
    const instrumenter = this.instrumenter = new Instrumenter();
    instrumenter.declareGlobal();
    hookRequire(
      file => !this.excludes.some(re => re.test(file)),
      contents => instrumenter.instrument(contents),
    );

    this.target = require(this.targetPath); // tslint:disable-line

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
    this.instrumenter.declareGlobal();
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

    const coverage = flattenBuckets(this.instrumenter.getLastCoverage());

    this.send({
      coverage: coverage.toString('binary'),
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
