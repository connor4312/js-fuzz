import { parseScript } from 'esprima';
import * as ESTrasverse from 'estraverse';
import { injectable, inject } from 'inversify';
import * as Types from '../dependencies';
import { HookManager } from './hook-manager';
import * as RandExp from 'randexp';
import { randn } from '../Math';
import { RegExpLiteral } from 'estree';

/**
 * The LiteralExtractor reads all literals from required javascript modules.
 * This is used to seed the corpus with interesting data.
 */
@injectable()
export class LiteralExtractor {
  constructor(@inject(Types.HookManager) private readonly hooks: HookManager) {}

  /**
   * Detects and returns all literals in files required synchronously within
   * the given function.
   */
  public async detectAll(fn: () => Promise<void>): Promise<Set<string>> {
    const literals = new Set<string>();
    const unhook = this.hooks.hookRequire(src => {
      this.addToSet(src, literals);
      return src;
    });

    try {
      await fn();
    } finally {
      unhook();
    }

    return literals;
  }

  public detect(code: string): Set<string> {
    const literals = new Set<string>();
    this.addToSet(code, literals);
    return literals;
  }

  private addToSet(code: string, literals: Set<string>) {
    ESTrasverse.traverse(parseScript(code), {
      enter: stmt => {
        if (stmt.type !== 'Literal') {
          return;
        }

        if ('regex' in stmt) {
          this.addRegex(stmt, literals);
        } else {
          literals.add(String(stmt.value));
        }
      },
    });
  }

  private addRegex(stmt: RegExpLiteral, literals: Set<string>) {
    const randexp = new RandExp(stmt.regex.pattern, stmt.regex.flags);
    randexp.max = 1; // mutators will take care of duplicating out, no need to add noise
    randexp.randInt = randn;

    // Add in a few variations for good measure
    for (let i = 0; i < 3; i++) {
      literals.add(randexp.gen());
    }

    // And high-matching sequences
    randexp.defaultRange.subtract(32, 126);
    randexp.defaultRange.add(0, 65535);
    for (let i = 0; i < 3; i++) {
      literals.add(randexp.gen());
    }
  }
}
