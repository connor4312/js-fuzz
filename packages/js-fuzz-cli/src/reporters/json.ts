import { IReporter } from '.';
import { Stat, StatType, WorkResult } from 'js-fuzz-core';

/**
 * Reporter that writes JSON to standard out.
 */
export class JsonReporter implements IReporter {
  private runs = 0;
  private crashers = 0;
  private printInterval?: NodeJS.Timer;

  public write(stats: Stat) {
    if (stats.type !== StatType.WorkerExecuted) {
      this.writeJson(stats);
      return;
    }

    if (this.printInterval === undefined) {
      this.setupPrintLoop();
    }

    this.runs++;
    if (stats.summary.result === WorkResult.Error) {
      this.crashers++;
    }
  }

  public close() {
    if (this.printInterval !== undefined) {
      clearInterval(this.printInterval);
    }
  }

  private setupPrintLoop() {
    let lastPrint = Date.now();
    let lastRuns = this.runs;

    this.printInterval = setInterval(() => {
      const now = Date.now();
      const runsPerSecond = Math.round(((this.runs - lastRuns) / (now - lastPrint)) * 1000);
      this.writeJson({ type: 'summary', runs: this.runs, crashers: this.crashers, runsPerSecond });
      lastRuns = this.runs;
      lastPrint = now;
    }, 1000);
  }

  protected writeJson(data: object) {
    process.stdout.write(JSON.stringify(data) + '\r\n');
  }
}
