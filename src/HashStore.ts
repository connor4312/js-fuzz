/**
 * The hash store saves a bunch of Buffers and provides methods to efficiently
 * check to see if a given buffer is in the store yet.
 */
export class HashStore {

  private store: { [prefix: string]: Buffer | Buffer[] } = Object.create(null);
  private count = 0;

  /**
   * PrefixLength is the number of bytes from the has to use for indexing.
   * A greater length will result in more memory usage but faster checking.
   * Defaults to 2, a 64KB table. Assumes that the buffers inserted are
   * random and are at least prefixLength bytes long.
   */
  constructor(private prefixLength: number = 2) {}

  /**
   * Returns the number of hashes currently stored.
   */
  public size(): number {
    return this.count;
  }

  /**
   * Returns a hash for the provided buffer.
   */
  public getHashFor(buf: Buffer): string {
    if (buf.length < this.prefixLength) {
      throw new Error('Cannot store a buffer less then the prefix length');
    }

    return buf
      .slice(0, this.prefixLength)
      .toString('hex');
  }

  /**
   * Returns whether the buffer with the given hash exists.
   */
  public exists(hash: string, buf: Buffer) {
    const records = this.store[hash];
    if (!records) {
      return false;
    }
    if (!(records instanceof Array)) {
      return records.equals(buf);
    }

    for (let i = 0; i < records.length; i += 1) {
      if (records[i].equals(buf)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Saves a hash in the store.
   */
  public put(hash: string, buf: Buffer) {
    const records = this.store[hash];
    if (records) {
      if (records instanceof Array) {
        records.push(buf);
      } else {
        this.store[hash] = [records, buf];
      }
    } else {
      this.store[hash] = [buf];
    }

    this.count += 1;
  }

  /**
   * Inserts the buffer into the store if it doesn't exist, returns true
   * if it was inserted.
   */
  public putIfNotExistent(buf: Buffer): boolean {
    const hash = this.getHashFor(buf);
    if (this.exists(hash, buf)) {
      return false;
    }

    this.put(hash, buf);
    return true;
  }
}
