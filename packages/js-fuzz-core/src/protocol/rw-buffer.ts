
/**
 * RWBuffer is a simple implementation of a byte buffer with read and write pointers.
 */
class RWBuffer {
  private underlying: Buffer;
  private writePtr = 0;
  private readPtr = 0;

  constructor(size: number = 10 * 1024 * 1024) {
    this.underlying = Buffer.allocUnsafe(size);
  }

  /**
   * Copies the input buffer to the underlying storage.
   */
  public write(input: Buffer) {
    this.grow(input.length);
    input.copy(this.underlying, this.writePtr);
    this.writePtr += input.length;
  }

  /**
   * Returns the slice of the buffer that has been written but not read yet.
   * This will share memory with the underlying buffer and is NOT safe to
   * mutate or use after write() is called.
   */
  public getUnread(): Buffer {
    return this.underlying.slice(this.readPtr, this.writePtr);
  }

  /**
   * Advances the read pointer by the given amount.
   */
  public advanceRead(amount: number) {
    this.readPtr += amount;
  }

  /**
   * Returns the number of unread bytes in the buffer.
   */
  public length() {
    return this.writePtr - this.readPtr;
  }

  /**
   * Gets the underlying buffer size.
   */
  public underlyingSize() {
    return this.underlying.length;
  }

  /**
   * Peeks at the next byte in the buffer, advancing the read pointer.
   */
  public peek(): number {
    if (this.readPtr === this.writePtr) {
      throw new RangeError('out of bound');
    }

    const byte = this.underlying.readUInt8(this.readPtr);
    this.readPtr += 1;
    return byte;
  }

  /**
   * Grows the underlying buffer to ensure there's space to write the
   * provided message.
   */
  private grow(size: number) {
    // Grow if the message is too large to fit in our buffer at all.
    for (let ulen = this.underlying.length; size >= ulen; ulen *= 2) {
      const next = Buffer.allocUnsafe(ulen * 2);
      this.underlying.copy(next, 0, this.readPtr, this.writePtr);
      this.writePtr -= this.readPtr;
      this.readPtr = 0;
      this.underlying = next;
    }

    // Reset the pointers and positioning if writing the message would go
    // past the end of the buffer.
    if (this.writePtr + size >= this.underlying.length) {
      this.underlying.copy(this.underlying, 0, this.readPtr, this.writePtr);
      this.writePtr -= this.readPtr;
      this.readPtr = 0;
    }
  }
}
