import { PacketKind, WorkResult, IWorkSummary } from "../protocol/types";

/**
 * The Input is a record for a particular job. It can contain a Coverage hash.
 */
export class Input {
  public static zero = new Input(
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
