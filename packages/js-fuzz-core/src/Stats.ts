import { EventEmitter } from 'events';

interface ISeries {
  x: number[];
  y: number[];
}

/**
 * Returns an array of length `count` filled with the value.
 */
function fill<T>(count: number, item: any): T[] {
  const output: T[] = [];
  for (let i = 0; i < count; i += 1) {
    if (typeof item === 'function') {
      output.push(item());
    } else {
      output.push(item);
    }
  }

  return output;
}

export class Stats extends EventEmitter {

  private static drawInterval = 1000;

  private workerProcesses = 0;
  private execs = 0;

  private startedAt = Date.now();
  private execsSeries: number[][];
  private coverSeries: number[];

  /**
   * Creates a new stats instance, specifying the interval over which data
   * will be kept.
   */
  constructor(interval: number = 30 * 1000) {
    super();

    const count = Math.round(interval / Stats.drawInterval);
    this.execsSeries = fill(count, () => []);
    this.coverSeries = fill(count, 0);

    setInterval(() => this.shiftSeries(), Stats.drawInterval);
  }

  private shiftSeries() {
    this.emit('draw');
    this.execsSeries.unshift([]);
    this.execsSeries.pop();
    this.coverSeries.unshift(this.coverSeries[0]);
    this.coverSeries.pop();
  }

  /**
   * Increments the number of executions that have been run.
   */
  public recordExec(fromWorker: number) {
    this.execs += 1;
    this.execsSeries[0][fromWorker] = (this.execsSeries[0][fromWorker] || 0) + 1;
  }

  /**
   * Records the number of covered branches.
   */
  public recordCoverageBranches(count: number) {
    this.coverSeries[0] = count;
  }

  /**
   * Writes a log message to the output.
   */
  public log(text: string) {
    this.emit('log', text);
  }

  /**
   * Sets the number of worker processes.
   */
  public setWorkerProcesses(amt: number) {
    this.workerProcesses = amt;
  }

  /**
   * Returns the number of worker processes.
   */
  public getWorkerProcesses(): number {
    return this.workerProcesses;
  }

  /**
   * Returns the number of executions over the lifetime of the process.
   */
  public getTotalExecs() {
    return this.execs;
  }

  /**
   * Returns the number of executions per second, grouped by time.
   */
  public getExecPlot(): ISeries {
    const output: ISeries = { x: [], y: [] };
    for (let i = this.execsSeries.length - 1; i >= 0; i -= 1) {
      output.x.push(i - Stats.drawInterval);

      let total = 0;
      for (let k = 0; k < this.execsSeries[i].length; k += 1) {
        total += this.execsSeries[i][k] || 0;
      }
      output.y.push(total);
    }
    return output;
  }

  /**
   * Returns branch coverage over time.
   */
  public getCoverPlot(): ISeries {
    const output: ISeries = { x: [], y: [] };
    for (let i = this.coverSeries.length - 1; i >= 0; i -= 1) {
      output.x.push(i - Stats.drawInterval);
      output.y.push(this.coverSeries[i]);
    }

    return output;
  }

  /**
   * Returns the number of executions per `scale` seconds for a single worker.
   * Scale must be a multiple of the collection duration over the draw interval.
   */
  public getWorkerExecPlot(worker: number, scale: number = 1): number[] {
    const output = [];
    for (let i = this.execsSeries.length - 1; i >= 0; i -= 1) {
      let sum = 0;
      for (const end = i - scale; i > end; i -= 1) {
        sum += this.execsSeries[i][worker] || 0;
      }

      output.push(sum);
    }

    return output;
  }

  /**
   * Returns the number of unique code paths/branches hit.
   */
  public getBranchCount(): number {
    return this.coverSeries[0];
  }

  /**
   * Returns the number of times code was executed in the last second.
   */
  public getExecsPerSecond(): number {
    return this.execsSeries[0].reduce((prev, x) => prev + (x || 0), 0);
  }

  /**
   * Returns how long the process has been running, in milliseconds.
   * @return {number} [description]
   */
  public getUptime(): number {
    return Date.now() - this.startedAt;
  }
}
