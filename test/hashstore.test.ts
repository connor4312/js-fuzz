import { expect } from 'chai';
import { randomBytes } from 'crypto';
import { HashStore } from '../src/HashStore';

describe('HashStore', () => {
  let store: HashStore;
  beforeEach(() => store = new HashStore());

  it('stores new, does not overwrite', () => {
    const input = randomBytes(64);
    expect(store.putIfNotExistent(input)).to.be.true;
    expect(store.putIfNotExistent(input)).to.be.false;
  });

  it('throws if too short', () => {
    const input = randomBytes(1);
    expect(() => store.putIfNotExistent(input)).to.throw();
  });

  it('stores similar inputs', () => {
    const input1 = randomBytes(64);
    const input2 = Buffer.from(input1);
    input2[input2.length - 1] += 1;

    expect(store.size()).to.equal(0);
    expect(store.putIfNotExistent(input1)).to.be.true;
    expect(store.putIfNotExistent(input1)).to.be.false;
    expect(store.size()).to.equal(1);
    expect(store.putIfNotExistent(input2)).to.be.true;
    expect(store.putIfNotExistent(input2)).to.be.false;
    expect(store.size()).to.equal(2);
  });
});
