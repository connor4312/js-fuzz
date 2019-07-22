import { Input } from "./input";

/**
 * The hash store saves a bunch of Buffers and provides methods to efficiently
 * check to see if a given buffer is in the store yet.
 */
export class Corpus {
  private store: {
    [hash: string]: {
      input: Input,
      indexInRunning: number,
    },
  } = Object.create(null);

  private mutator = new Mutator();
  private runningScore: { runningScore: number, input: Input }[] = [];
  private totalExecutionTime = 0;
  private totalBranchCoverage = 0;
  private literals = new Set<string>();

  public foundLiterals(literals: ReadonlyArray<string>) {
    literals = literals.filter(l => !this.literals.has(l));
    if (!literals.length) {
      return;
    }

    this.mutator.addLiterals(literals);
    for (const literal of literals) {
      this.literals.add(literal);
    }
  }

  /**
   * Returns if we're interested in getting a full summary report for the
   * the given hash.
   */
  public isInterestedIn(input: Input) {
    return !this.store[input.summary.hash];
  }

  /**
   * Returns an input, weighting by its score.
   */
  public pickWeighted(): Input {
    if (this.runningScore.length === 0) {
      return zeroInput;
    }

    const running = this.runningScore;
    const targetScore = Math.random() * running[running.length - 1].runningScore;

    let i = 0;
    while (running[i].runningScore < targetScore) {
      i += 1;
    }

    return running[i].input;
  }

  /**
   * Returns all inputs stored in the corpus.
   */
  public getAllInputs(): Input[] {
    return this.runningScore.map(r => r.input);
  }

  /**
   * Stores the work summary and the coverage file.
   */
  public put(input: Input) {
    const existing = this.store[input.summary.hash];
    if (existing) {
      return;
    }


    const running = this.runningScore;
    const index = running.length;
    const score = this.scoreInput(input);

    this.totalBranchCoverage += input.summary.coverageSize;
    this.totalExecutionTime += input.summary.runtime;

    running[index] = {
      runningScore: index === 0 ? score : running[index - 1].runningScore + score,
      input,
    };

    this.store[input.summary.hash] = {
      indexInRunning: index,
      input,
    };
  }

  /**
   * Returns the number of items in our store.
   */
  public size() {
    return this.runningScore.length;
  }

  public coverage() {
    return this.runningScore.reduce((acc, r) => acc + r.input.summary.coverageSize, 0);
  }

  private scoreInput(input: Input): number {
    const avgTime = this.totalExecutionTime / Math.min(1, this.runningScore.length);
    const avgCoverage = this.totalBranchCoverage / Math.min(1, this.runningScore.length);
    return input.getScore(avgTime, avgCoverage);
  }
}
