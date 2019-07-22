import { IMutationAlgorithm, IMutationContext, mutators } from './algorithms';
import { pickOne } from '../Math';
import { injectable, inject } from 'inversify';
import { MutationAlgorithms } from '../dependencies';

/**
 * Mutation manager.
 */
@injectable()
export class Mutator {
  private context: IMutationContext = { literals: [] };

  constructor(
    @inject(MutationAlgorithms)
    private readonly algorithms: ReadonlyArray<IMutationAlgorithm> = mutators,
  ) {}

  /**
   * Adds a new literal that can be used for mutations.
   */
  public addLiterals(literals: ReadonlyArray<string>) {
    this.context = {
      ...this.context,
      literals: [...this.context.literals, ...literals],
    };
  }

  /**
   * Mutates the input buffer.
   */
  public mutate(input: Buffer) {
    let mutations = 1;
    while (Math.random() < 0.5) {
      mutations += 1;
    }

    for (let i = 0; i < mutations; i += 1) {
      const next = pickOne(this.algorithms)(input, this.context);
      if (next !== null) {
        input = next;
      } else {
        i -= 1;
      }
    }

    return input;
  }
}
