import { createHash } from 'crypto';
import { hookRequire, Instrumenter } from './Instrumenter';
import { roundUint8ToNextPowerOfTwo } from './Math';
import {
  IModule,
  ipcCall,
  PacketKind,
  Protocol,
  WorkResult,
} from './Protocol';

/**
 * Evens off the statement count in the coverage into count "buckets" and
 * returns the sum of all buckets.
 */
function flattenBuckets(coverage: Buffer): [Buffer, number] {
  let total = 0;
  for (let i = 0; i < coverage.length; i += 1) {
    coverage[i] = roundUint8ToNextPowerOfTwo(coverage[i]);
    total += coverage[i];
  }
  return [coverage, total];
}

/**
 * Returns a relative time in microseconds.
 */
function getMicroTime(): number {
  const [s, ns] = process.hrtime();
  return s * 10e6 + ns / 10e4;
}

/**
 * The worker is attached to a Cluster and runs the target script when the
 * manager asks for it, reporting back code coverage metrics.
 */
export class Worker {

  /**
   * The module to be put under fuzzing
   */
  private target!: IModule;
  /**
   * List of modules to exclude from code coverage analysis.
   */
  private excludes: RegExp[] = [];

  /**
   * Instrumenter used for the worker code's code.
   */
  private instrumenter!: Instrumenter;

  private lastCoverage!: Buffer;
  private proto!: Protocol;

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
      case PacketKind.RequestCoverage:
        proto.write({
          kind: PacketKind.WorkCoverage,
          coverage: this.lastCoverage,
        });
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

  private runFuzz(
    input: Buffer,
    callback: (err: any, res: WorkResult) => void,
  ): void {
    let called = false;
    const handler = (err: any, res: WorkResult) => {
      if (called) {
        return;
      }

      called = true;
      process.removeListener('uncaughtException', handler);
      callback(err, res);
    };

    process.once('uncaughtException' as any, handler);

    try {
      this.runFuzzInner(input, handler);
    } catch (e) {
      handler(e, null as any);
    }
  }
  private runFuzzInner(
    input: Buffer,
    callback: (err: any, res: WorkResult) => void,
  ): void {
    if (this.target.fuzz.length > 1) {
      this.target.fuzz(input, callback);
      return;
    }

    const out = this.target.fuzz(input);
    if (out && typeof out.then === 'function') {
      out.then(res => callback(null, res))
        .catch(err => callback(err, null as any));
      return;
    }

    callback(null, <any> out);
  }

  private doWork(input: Buffer): void {
    this.instrumenter.declareGlobal();

    const start = getMicroTime();

    this.runFuzz(input, (error, result) => {
      const runtime = getMicroTime() - start;
      const [coverage, size] = flattenBuckets(this.instrumenter.getLastCoverage());
      this.lastCoverage = coverage;

      this.proto.write({
        coverageSize: size,
        error: error ? error.stack || error.message || error : undefined,
        hash: createHash('md5').update(coverage).digest('hex'),
        inputLength: input.length,
        kind: PacketKind.WorkSummary,
        result,
        runtime,
      });
    });
  }
}

if (require.main === module) {
  new Worker(process.argv[2], JSON.parse(process.argv[3])).start();
}
