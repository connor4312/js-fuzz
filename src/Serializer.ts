import { createHash } from 'crypto';
import { existsSync, mkdirSync, readdir, readFile, writeFile } from 'graceful-fs';

import { Corpus, Input } from './Corpus';
import { PacketKind, WorkResult } from './Protocol';

export interface ISerializer {
  /**
   * Returns that a timeout occurred as a result of the provided input.
   */
  storeTimeout(rawInput: Buffer): Promise<void>;

  /**
   * Store the error that occurred as a result of the input.
   */
  storeCrasher(input: Input, error: string): Promise<void>;

  /**
   * Serializes the corpus and saves it on the disk.
   */
  storeCorpus(corpus: Corpus): Promise<void>;

  /**
   * Attempts to load a corpus from its serialized version.
   */
  loadCorpus(): Promise<Corpus>;
}

function writeFileAsync(path: string, contents: string | Buffer): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    writeFile(path, contents, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function readFileAsync(path: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    readFile(path, (err, contents) => {
      if (err) {
        reject(err);
      } else {
        resolve(contents);
      }
    });
  });
}

function ensureDir(path: string) {
  if (!existsSync(path)) {
    mkdirSync(path);
  }
}

export class FileSerializer implements ISerializer {

  constructor(private root: string = process.cwd()) {
    ensureDir(`${root}/fuzz-output`);
    ensureDir(this.getCrashersDir());
    ensureDir(this.getCorpusDir());
  }

  public storeTimeout(rawInput: Buffer): Promise<void> {
    return this.storeCrasherFile(
      'timeout',
      'The process timed out when processing this input',
      rawInput,
    );
  }

  public storeCrasher(input: Input): Promise<void> {
    return this.storeCrasherFile(
      input.summary.hash,
      input.summary.error,
      input.input,
    );
  }

  public storeCorpus(corpus: Corpus): Promise<void> {
    return Promise.all(
      corpus
        .getAllInputs()
        .map(input => {
          return writeFileAsync(
            `${this.getCorpusDir()}/${input.summary.hash}`,
            input.serialize(),
          );
        }),
    ).then(() => undefined);
  }

  public loadCorpus(): Promise<Corpus> {
    const corpus = new Corpus();

    return new Promise<string[]>((resolve, reject) => {
      readdir(this.getCorpusDir(), (err, files) => {
        if (err) {
          reject(err);
        } else {
          resolve(files);
        }
      });
    }).then(files => {
        return Promise.all(
          files
            .map(file => `${this.getCorpusDir()}/${file}`)
            .map(file => readFileAsync(file)),
        );
      })
      .then(contents => {
        contents
          .map(data => {
            try {
              return Input.Deserialize(data.toString('utf8'));
            } catch (e) {
              // fall through
            }

            return new Input(data, 0, {
              kind: PacketKind.WorkSummary,
              result: WorkResult.Allow,
              coverageSize: 0,
              inputLength: data.length,
              hash: createHash('md5').update(data).digest('hex'),
              runtime: Infinity,
            });
          })
          .forEach(input => corpus.put(input));

        return corpus;
      });
  }

  private storeCrasherFile(hash: string, error: string, rawInput: Buffer): Promise<void> {
    const contents = JSON.stringify({
      error,
      input: {
        utf8: rawInput.toString('utf8'),
        hex: rawInput.toString('hex'),
        base64: rawInput.toString('base64'),
      },
    }, null, 2);

    return writeFileAsync(`${this.getCrashersDir()}/${hash}.json`, contents);
  }

  private getCrashersDir() {
    return `${this.root}/fuzz-output/crashers`;
  }

  private getCorpusDir() {
    return `${this.root}/fuzz-output/corpus`;
  }
}
