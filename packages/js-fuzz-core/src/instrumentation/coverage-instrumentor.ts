import { generate } from 'escodegen';
import { parseScript } from 'esprima';
import * as ESTrasverse from 'estraverse';
import {
  BlockStatement,
  Expression,
  ExpressionStatement,
  Node,
  SequenceExpression,
  Statement,
} from 'estree';
import { injectable, inject } from 'inversify';
import { IFuzzOptions } from '../options';
import * as Types from '../dependencies';
import { HookManager } from './hook-manager';

export interface IInstrumenterOptions {
  /**
   * Defines the number of bits to use in the hash table, calculated as
   * (1 << hashBits). Using a higher number will result in slightly more
   * accurate coverage at the cost of greater memory usage, and may
   * result in an increased number of cache misses. Defaults to
   * 16 (a 64kb table) as AFL.
   */
  hashBits: number;

  /**
   * Global hash table name, defaults to __coverage__ a la Istanbul.
   */
  hashName: string;

  /**
   * Whether to use deterministic keys, this should be used ONLY for testing
   * and will seriously screw up the fuzzer if used in production.
   */
  deterministicKeys: boolean;
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
function prependBlock(
  block: Statement,
  toPrepend: ExpressionStatement[],
): BlockStatement | ExpressionStatement {
  switch (block.type) {
    case 'BlockStatement':
      block.body = (<Statement[]>toPrepend).concat(block.body);
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
function prependExpression(
  block: Expression,
  toPrepend: ExpressionStatement[],
): SequenceExpression {
  return {
    type: 'SequenceExpression',
    expressions: toPrepend.map(expr => expr.expression).concat(block),
  };
}

/**
 * The Instrumenter transforms JavaScript code adding coverage measurements
 * as described in AFL's whitepaper here:
 * http://lcamtuf.coredump.cx/afl/technical_details.txt
 */
@injectable()
export class ConverageInstrumentor {
  private deterministCounter = 0;
  private options: IInstrumenterOptions;
  private detachFn?: () => void;

  constructor(
    @inject(Types.HookManager) private readonly hooks: HookManager,
    @inject(Types.FuzzOptions) options: Pick<IFuzzOptions, 'instrumentor'>,
  ) {
    this.options = {
      hashBits: 16,
      hashName: '__coverage__',
      deterministicKeys: false,
      ...options.instrumentor,
    };
  }

  /**
   * Hooks the instrumenter into the require() statement.
   */
  public attach() {
    this.detach();
    this.declareGlobal();
    return this.hooks.hookRequire(code => this.instrument(code));
  }

  public detach() {
    if (this.detachFn) {
      this.detachFn();
      this.detachFn = undefined;
    }
  }

  /**
   * Instruments the provided code with branch analysis instructions.
   */
  public instrument(code: string) {
    return generate(
      ESTrasverse.replace(parseScript(code), {
        enter: stmt => this.instrumentBranches(stmt),
      }),
    );
  }

  /**
   * Initializes the global hash table, this should be called before
   * instrumented code is run.
   */
  public declareGlobal() {
    (<any>global)[this.getPrevStateName()] = 0;
    const existing: Buffer = (<any>global)[this.options.hashName];
    if (existing) {
      existing.fill(0);
    } else {
      (<any>global)[this.options.hashName] = Buffer.alloc(1 << this.options.hashBits);
    }
  }

  /**
   * Returns the last coverage hashmap.
   */
  public getLastCoverage(): Buffer {
    return (<any>global)[this.options.hashName];
  }

  /**
   * Walks and instruments the AST tree.
   */
  private instrumentBranches(stmt: Node) {
    switch (stmt.type) {
      case 'IfStatement':
        stmt.consequent = prependBlock(ensureBlock(stmt.consequent), this.createTransitionBlock());
        stmt.alternate =
          stmt.alternate && prependBlock(ensureBlock(stmt.alternate), this.createTransitionBlock());
        return stmt;
      case 'ConditionalExpression':
        stmt.consequent = prependExpression(stmt.consequent, this.createTransitionBlock());
        stmt.alternate = prependExpression(stmt.alternate, this.createTransitionBlock());
        return stmt;
      case 'LogicalExpression':
        stmt.left = prependExpression(stmt.left, this.createTransitionBlock());
        stmt.right = prependExpression(stmt.right, this.createTransitionBlock());
        return stmt;
      case 'SwitchCase':
        stmt.consequent = (<Statement[]>this.createTransitionBlock()).concat(stmt.consequent);
        return stmt;
      default:
        return stmt;
    }
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
      return (this.deterministCounter += 1);
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
