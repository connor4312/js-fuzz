import { readFileSync } from 'fs';
import { inject, injectable } from 'inversify';
import { IFuzzOptions } from '../options';
import * as Types from '../dependencies';
import * as minimatch from 'minimatch';

/**
 * Handles hooking into Node's require.
 */
@injectable()
export class HookManager {
  constructor(@inject(Types.FuzzOptions) private readonly options: Pick<IFuzzOptions, 'exclude'>) {}

  /**
   * Hooks the transformation function into Node's require(). Returns a
   * function that can be used to unhook it.
   */
  public hookRequire(transform: (input: string) => string, extension = '.js') {
    const previous = require.extensions[extension];
    require.extensions[extension] = (m: any, fname: string) => {
      const contents = readFileSync(fname, 'utf8');
      if (!this.isFileExcluded(fname)) {
        m._compile(transform(contents), fname);
      } else {
        m._compile(contents, fname);
      }
    };

    return () => {
      require.extensions[extension] = previous;
    };
  }

  private isFileExcluded(name: string) {
    for (const pattern of this.options.exclude) {
      if (minimatch(name, pattern)) {
        return true;
      }
    }

    return false;
  }
}
