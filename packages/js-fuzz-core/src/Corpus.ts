import { IWorkSummary, PacketKind, WorkResult } from './Protocol';
import { Mutator } from './mutations/mutator';

/**
 * The Input is a record for a particular job. It can contain a Coverage hash.
 */
export class Input {

  private static initialScore = 10;
  private static minScore = 1;
  private static maxScore = 100;

  constructor(
    public readonly input: Buffer,
    public readonly depth: number,
    public readonly summary: IWorkSummary,
  ) {}

  /**
   * Serializes an input into a string.
   */
  public serialize(): string {
    return JSON.stringify({
      input: this.input.toString('hex'),
      depth: this.depth,
      summary: this.summary,
      $isJsFuzz: true,
    });
  }

  /**
   * Returns whether this input resulted in more interesting behavior
   * that the other one. This is mostly ported from go-fuzz
   * @see https://git.io/vMwjF
   */
  public getScore(averageExecutionTime: number, averageCoverSize: number): number {
    let score = Input.initialScore;
    // Execution time multiplier 0.1-3x.
    // Fuzzing faster inputs increases efficiency.

    const timeRatio = this.summary.runtime / averageExecutionTime;
    if (timeRatio > 10) {
      score /= 10;
    } else if (timeRatio > 4) {
      score /= 4;
    } else if (timeRatio > 2) {
      score /= 2;
    } else if (timeRatio < 0.25) {
      score *= 3;
    } else if (timeRatio < 0.33) {
      score *= 2;
    } else if (timeRatio < 0.5) {
      score *= 1.5;
    }

    // Coverage size multiplier 0.25-3x.
    // Inputs with larger coverage are more interesting.
    const coverSize = this.summary.coverageSize / averageCoverSize;
    if (coverSize > 3) {
      score *= 3;
    } else if (coverSize > 2) {
      score *= 2;
    } else if (coverSize > 1.5) {
      score *= 1.5;
    } else if (coverSize < 0.3) {
      score /= 4;
    } else if (coverSize < 0.5) {
      score /= 2;
    } else if (coverSize < 0.75) {
      score /= 1.5;
    }

    // Input depth multiplier 1-5x.
    // Deeper inputs have higher chances of digging deeper into code.
    if (this.depth < 10) {
      // no boost for you
    } else if (this.depth < 20) {
      score *= 2;
    } else if (this.depth < 40) {
      score *= 3;
    } else if (this.depth < 80) {
      score *= 4;
    } else {
      score *= 5;
    }

    // User boost (Fuzz function return value) multiplier 1-2x.
    // We don't know what it is, but user said so.
    if (this.summary.result === WorkResult.Reinforce) {
      // Assuming this is a correct input (e.g. deserialized successfully).
      score *= 2;
    }

    return Math.min(Input.maxScore, Math.max(Input.minScore, score));
  }

  /**
   * Deserializes the input string to a qualified Input object
   */
  public static Deserialize(input: string): Input {
    const parsed = JSON.parse(input);
    if (!parsed.$isJsFuzz) {
      throw new SyntaxError('The provided packet is not a js-fuzz input');
    }

    return new Input(
      Buffer.from(parsed.input, 'hex'),
      parsed.depth,
      parsed.summary,
    );
  }
}

const zeroInput = new Input(
  Buffer.from([]),
  0,
  {
    kind: PacketKind.WorkSummary,
    result: WorkResult.Allow,
    coverageSize: 0,
    inputLength: 0,
    hash: '',
    runtime: Infinity,
  },
);

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
  public totalScore = 0;

  public foundLiterals(literals: ReadonlyArray<string>) {
    literals = literals.filter(l => !this.literals.has(l));
    if (!literals.length) {
      return;
    }
console.log('adding literals', literals);
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
    const existing = this.store[input.summary.hash];
    if (!existing) {
      return true;
    }

    return this.scoreInput(input) > this.scoreInput(existing.input);
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
    let index: number;
    const running = this.runningScore;
    const existing = this.store[input.summary.hash];
    const score = this.scoreInput(input);

    // If we have an existing record, adjust all the counters to remove
    // the old record and add the new one. Otherwise, just add up the
    // new score, coverage, and runtime.
    if (existing) {
      this.totalBranchCoverage += input.summary.coverageSize - existing.input.summary.coverageSize;
      this.totalExecutionTime += input.summary.runtime - existing.input.summary.runtime;

      const delta = score - this.scoreInput(existing.input);
      index = existing.indexInRunning;
      for (let i = index + 1; i < running.length; i += 1) {
        running[i].runningScore += delta;
      }
      this.totalScore += delta;
    } else {
      index = running.length;
      this.totalBranchCoverage += input.summary.coverageSize;
      this.totalExecutionTime += input.summary.runtime;
      this.totalScore += score;
    }

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

  private scoreInput(input: Input): number {
    const avgTime = this.totalExecutionTime / Math.min(1, this.runningScore.length);
    const avgCoverage = this.totalBranchCoverage / Math.min(1, this.runningScore.length);
    return input.getScore(avgTime, avgCoverage);
  }
}
