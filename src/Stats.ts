import { EventEmitter } from 'events';

const prettyMs = require('pretty-ms');
const blessed = require('blessed');
const contrib = require('blessed-contrib');
const filesize = require('filesize');
const fs = require('fs');

const UPDATE_STATS_EVENT = 'update stats';

interface ISeries {
  x: number[];
  y: number[];
}

/**
 * Returns an array of length `count` filled with the value.
 */
function fill<T>(count: number, item: T | (() => T)): T[] {
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
  constructor(private interval: number = 30 * 1000) {
    super();

    const count = Math.round(interval / Stats.drawInterval);
    this.execsSeries = fill(count, () => []);
    this.coverSeries = fill(count, 0);

    setInterval(() => this.shiftSeries(), Stats.drawInterval);
  }

  private shiftSeries() {
    this.emit(UPDATE_STATS_EVENT);
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

export class StatsWriter {

  private filename: string;

  constructor(private stats: Stats,
    private onExit: () => void,
    filename?: string
  ){
    stats.on(UPDATE_STATS_EVENT, () => this.writeFile());
    this.filename = filename || 'exec-stats'
  }

  private writeFile() {
    const exec = this.stats.getExecsPerSecond();
    const uptime = prettyMs(this.stats.getUptime());
    fs.appendFile(`fuzz-output/${this.filename}`, `${uptime}:${exec}\n`,
      (err: Error) => {});
  }
}

export class BlessedRenderer {

  private stats: Stats;
  private screen = blessed.screen();
  private grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });
  private panels = {
    stats: this.grid.set(0, 0, 3, 2, blessed.box, {
      label: 'Status',
      tags: true,
    }),
    log: this.grid.set(4, 2, 8, 10, contrib.log, {
      fg: 'red',
      selectedFg: 'white',
      label: 'Crash Logs',
    }),
    execsOverallChart: this.grid.set(0, 2, 4, 5, contrib.line, {
      label: 'Overall Throughput (execs/sec)',
      style: {
        line: 'yellow',
        text: 'green',
        baseline: 'black',
      },
      wholeNumbersOnly: true,
    }),
    coverageOverallChart: this.grid.set(0, 7, 4, 5, contrib.line, {
      label: 'Branches Covered',
      style: {
        line: 'yellow',
        text: 'green',
        baseline: 'black',
      },
      wholeNumbersOnly: true,
    }),
    execsPerWorker: this.grid.set(3, 0, 9, 2, contrib.sparkline, {
      label: 'Worker Throughput',
      tags: true,
      style: { fg: 'blue' },
    }),
  };

  public attach(stats: Stats, onExit: () => void) {
    this.stats = stats;
    stats.on('log', (msg: string) => this.panels.log.log(String(msg)));
    stats.on(UPDATE_STATS_EVENT, () => this.redraw());
    this.screen.key(['escape', 'q', 'C-c', 'enter'], onExit);
    this.screen.render();
  }


  private redraw() {
    const workers = this.stats.getWorkerProcesses();
    this.panels.stats.setContent([
      `{green-fg}Uptime{/green-fg}: ${prettyMs(this.stats.getUptime())}`,
      `{green-fg}Worker Processes{/green-fg}: ${workers}`,
      `{green-fg}Branches hit{/green-fg}: ${this.stats.getBranchCount()}`,
      `{green-fg}Executions{/green-fg}: ${this.stats.getTotalExecs()}`,
      `{green-fg}Executions/sec{/green-fg}: ${this.stats.getExecsPerSecond()}`,
      `{green-fg}Heap Size{/green-fg}: ${filesize(process.memoryUsage().heapUsed)}`,
    ].join('\n'));

    const sparkColumns: string[] = [];
    const sparkData: number[][] = [];
    for (let i = 0; i < workers; i += 1) {
      sparkColumns.push(`Worker ${i}`);
      sparkData.push(this.stats.getWorkerExecPlot(i, 2));
    }

    this.panels.execsPerWorker.setData(sparkColumns, sparkData);
    this.panels.execsOverallChart.setData([this.stats.getExecPlot()]);
    this.panels.coverageOverallChart.setData([this.stats.getCoverPlot()]);
    this.screen.render();
  }
}
