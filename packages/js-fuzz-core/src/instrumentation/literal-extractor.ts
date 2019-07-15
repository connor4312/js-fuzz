import { parseScript } from 'esprima';
import * as ESTrasverse from 'estraverse';
import { injectable, inject } from 'inversify';
import * as Types from '../dependencies';
import { HookManager } from './hook-manager';

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
  public detectAll(fn: () => void): Set<string> {
    const literals = new Set<string>();
    const unhook = this.hooks.hookRequire(src => {
      this.addToSet(src, literals);
      return src;
    });

    try {
      fn();
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
        if (stmt.type === 'Literal') {
          literals.add(String(stmt.value));
        }
      },
    });
  }
}
