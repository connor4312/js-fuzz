import { hookRequire, Instrumenter } from './Instrumenter';
import { roundUint8ToNextPowerOfTwo } from './Math';
import { IModule, ipcCall, PacketKind, Protocol, WorkResult } from './Protocol';

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

  private proto: Protocol;

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

    const proto = this.proto = new Protocol(require('./fuzz'));
    this.proto = proto;

    proto.on('message', (msg: ipcCall) => {
      switch (msg.kind) {
      case PacketKind.DoWork:
        this.doWork(msg.input);
        break;
      default:
        throw new Error(`Unknown IPC call: ${msg.kind}`);
      }
    });

    proto.on('error', (err: Error) => {
      console.error(err);
      process.exit(1);
    });

    proto.attach(process.stdin, process.stdout);
    proto.write({ kind: PacketKind.Ready });
  }

  private doWork(input: Buffer): void {
    this.instrumenter.declareGlobal();

    let result: WorkResult;
    try {
      result = this.target.fuzz(input);
    } catch (e) {
      return this.proto.write({
        kind: PacketKind.CompletedWork,
        result: WorkResult.Error,
        error: e.stack || e.message,
      });
    }

    const coverage = flattenBuckets(this.instrumenter.getLastCoverage());

    this.proto.write({
      coverage,
      result,
      kind: PacketKind.CompletedWork,
    });
  }
}

if (require.main === module) {
  new Worker(process.argv[2], JSON.parse(process.argv[3])).start();
}
