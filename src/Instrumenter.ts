import { generate } from 'escodegen';
import { parse } from 'esprima';
import * as ESTrasverse from 'estraverse';
import {
  BlockStatement,
  Expression,
  ExpressionStatement,
  Node,
  SequenceExpression,
  Statement,
} from 'estree';

export interface IInstrumenterOptions {
  /**
   * Defines the number of bits to use in the hash table, calculated as
   * (1 << hashBits). Using a higher number will result in slightly more
   * accurate coverage at the cost of greater memory usage, and may
   * result in an increased number of cache misses. Defaults to
   * 16 (a 64kb table) as AFL.
   */
  hashBits?: number;

  /**
   * Global hash table name, defaults to __coverage__ a la Istanbul.
   */
  hashName?: string;

  /**
   * Whether to use deterministic keys, this should be used ONLY for testing
   * and will seriously screw up the fuzzer if used in production.
   */
  deterministicKeys?: boolean;
}

/**
 * Wraps the node as a block statement if it isn't already on.
 */
function ensureBlock(stmt: Statement): BlockStatement {
  if (!stmt) {
    return { type: 'BlockStatement', body: [] };
  }

  if (stmt.type !== 'BlockStatement') {
    return { type: 'BlockStatement', body: [stmt] };
  }

  return stmt;
}

/**
 * Prepends the list of statements to the provided block and returns it. If
 * the block to be prepended to is already a BlockExpression, we'll just
 * modify its body, otherwise we'll wrap it using the comma operator.
 */
function prependBlock(block: Statement, toPrepend: ExpressionStatement[]): BlockStatement | ExpressionStatement {
  switch (block.type) {
    case 'BlockStatement':
      block.body = (<Statement[]> toPrepend).concat(block.body);
      return block;
    case 'ExpressionStatement':
      block.expression = prependExpression(block.expression, toPrepend);
      return block;
    default:
      throw new Error(`Unsupported wrap type ${block.type}`);
  }
}

/**
 * Prepends the list of statements to the provided expression and returns it.
 */
function prependExpression(block: Expression, toPrepend: ExpressionStatement[]): SequenceExpression {
  return {
    type: 'SequenceExpression',
    expressions: toPrepend
      .map(expr => expr.expression)
      .concat(block),
  };
}

/**
 * The Instrumenter transforms JavaScript code adding coverage measurements
 * as described in AFL's whitepaper here:
 * http://lcamtuf.coredump.cx/afl/technical_details.txt
 */
export class Instrumenter {

  private deterministCounter = 0;
  private options: IInstrumenterOptions;

  constructor(options?: IInstrumenterOptions) {
    this.options = Object.assign({
      hashBits: 16,
      hashName: '__coverage__',
      deterministicKeys: false,
    }, options);
  }

  /**
   * Instruments the provided code with branch analysis instructions.
   */
  public instrument(code: string): string {
    return generate(this.walk(parse(code)));
  }

  /**
   * Initializes the global hash table, this should be called before
   * instrumented code is run.
   */
  public declareGlobal() {
    global[this.getPrevStateName()] = 0;
    const existing: Buffer = global[this.options.hashName];
    if (existing) {
      existing.fill(0);
    } else {
      global[this.options.hashName] = Buffer.alloc(1 << this.options.hashBits);
    }
  }

  /**
   * Walks and instruments the AST tree.
   */
  private walk(stmt: Node): Node {
    switch (stmt.type) {
      case 'IfStatement':
        stmt.consequent = prependBlock(
          ensureBlock(stmt.consequent),
          this.createTransitionBlock(),
        );
        stmt.alternate = stmt.alternate && prependBlock(
          ensureBlock(stmt.alternate),
          this.createTransitionBlock(),
        );
        break;
      case 'ConditionalExpression':
        stmt.consequent = prependExpression(stmt.consequent, this.createTransitionBlock());
        stmt.alternate = prependExpression(stmt.alternate, this.createTransitionBlock());
        break;
      case 'LogicalExpression':
        stmt.left = prependExpression(stmt.left, this.createTransitionBlock());
        stmt.right = prependExpression(stmt.right, this.createTransitionBlock());
        break;
      case 'SwitchCase':
        stmt.consequent = (<Statement[]> this.createTransitionBlock())
          .concat(stmt.consequent);
        break;
      default:
        // ignored
    }

    const toVisit: string[] = (<any> ESTrasverse).VisitorKeys[stmt.type] || [];
    toVisit.forEach(key => {
      const value = stmt[key];
      if (!value) {
        return;
      }

      stmt[key] = value instanceof Array
        ? value.map(s => this.walk(s))
        : this.walk(value);
    });

    return stmt;
  }

  /**
   * Creates a random, maybe-unique ID to tag a branch with in the range
   * [0, 1 << hashBits].
   *
   * We intentionally do not use an auto-increment here (in the live app)
   * since the hashing relies randomness across all bytes.
   */
  private createRandomID(): number {
    if (this.options.deterministicKeys) {
      return this.deterministCounter += 1;
    }

    return Math.floor(Math.random() * (1 << this.options.hashBits)); // tslint:disable
  }

  /**
   * Returns the name for the global var that holds the previous state.
   */
  private getPrevStateName(): string {
    return `${this.options.hashName}_prevState`;
  }

  private createTransitionBlock(): ExpressionStatement[] {
    const id = this.createRandomID();

    return [
      {
        type: 'ExpressionStatement',
        expression: {
          type: 'UpdateExpression',
          operator: '++',
          argument: {
            type: 'MemberExpression',
            computed: true,
            object: {
              type: 'Identifier',
              name: this.options.hashName,
            },
            property: {
              type: 'BinaryExpression',
              operator: '^',
              left: {
                type: 'Identifier',
                name: this.getPrevStateName(),
              },
              right: {
                type: 'Literal',
                value: id,
                raw: String(id),
              },
            },
          },
          prefix: false,
        },
      },
      {
        type: 'ExpressionStatement',
        expression: {
          type: 'AssignmentExpression',
          operator: '=',
          left: {
            type: 'Identifier',
            name: this.getPrevStateName(),
          },
          right: {
            type: 'Literal',
            value: id,
            raw: String(id),
          },
        },
      },
    ];
  }
}
