import { injectable } from "inversify";
import { createHash } from "crypto";
import { Inliner } from "./inliner";

/**
 * Hash bit size. A constant in go-fuzz. 64KB.
 */
const hashBits = 64 << 10;

const idBuffer = Buffer.alloc(4);

/**
 * Creates a new ID for the given coverage block.
 */
export function createCoverageId(counter: number) {
  idBuffer.writeInt32BE(counter | 0, 0) // bitwise force to an int32
  return createHash('sha1').update(idBuffer).digest().readUInt32BE(0);
}

/**
 * A service passed into the Runtime which provides a hash table that
 * records coverage.
 */
export interface ICoverageHash {
  increment: Inliner;
  reset(): void;
}

/**
 * A service passed into the Runtime which provides a hash table that
 * records coverage.
 */
@injectable()
export class CoverageHash implements ICoverageHash {
  private hash = Buffer.alloc(hashBits);

  public readonly increment = new Inliner((ctx, id) => ({
    type: 'UpdateExpression',
    operator: '++',
    prefix: false,
    argument: {
      type: 'MemberExpression',
      object: ctx.accessOwnProperty('hash'),
      property: id,
      computed: true,
    },
  }))

  public reset() {
    this.hash.fill(0);
  }
}
