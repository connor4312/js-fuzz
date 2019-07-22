import { expect } from 'chai';

describe('RWBuffer', () => {
  it('sets up correctly', () => {
    const buffer = new RWBuffer(4);
    expect(buffer.underlyingSize()).to.equal(4);
    expect(buffer.length()).to.equal(0);
    expect(buffer.getUnread()).to.equal(Buffer.from([]));
  });

  it('writes small data', () => {
    const buffer = new RWBuffer(4);
    buffer.write(Buffer.from('hi'));
    expect(buffer.underlyingSize()).to.equal(4);
    expect(buffer.length()).to.equal(2);
    expect(buffer.getUnread()).to.equal(Buffer.from('hi'));
  });

  it('advances pointer', () => {
    const buffer = new RWBuffer(4);
    buffer.write(Buffer.from('hi'));
    buffer.advanceRead(2);

    expect(buffer.underlyingSize()).to.equal(4);
    expect(buffer.length()).to.equal(0);
    expect(buffer.getUnread()).to.equal(Buffer.from([]));
  });

  it('shifts data without reallocating', () => {
    const buffer = new RWBuffer(4);
    buffer.write(Buffer.from('hi'));
    buffer.advanceRead(2);
    buffer.write(Buffer.from('hiya'));

    expect(buffer.underlyingSize()).to.equal(4);
    expect(buffer.length()).to.equal(4);
    expect(buffer.getUnread()).to.equal(Buffer.from('hiya'));
  });

  it('grows on large data', () => {
    const buffer = new RWBuffer(4);
    buffer.write(Buffer.from('hello world'));

    expect(buffer.underlyingSize()).to.equal(16);
    expect(buffer.length()).to.equal(11);
    expect(buffer.getUnread()).to.equal(Buffer.from('hello world'));
  });
});
