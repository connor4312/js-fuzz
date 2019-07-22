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
import * as Types from '../dependencies';
import { HookManager } from './hook-manager';
import { Runtime } from '../runtime/runtime';
import { createCoverageId } from '../runtime/coverage-hash';

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
function prependBlock(block: Statement, expr: Expression): BlockStatement | ExpressionStatement {
  switch (block.type) {
    case 'BlockStatement':
      block.body = [{ type: 'ExpressionStatement', expression: expr }, ...block.body];
      return block;
    case 'ExpressionStatement':
      block.expression = prependExpression(block.expression, expr);
      return block;
    default:
      throw new Error(`Unsupported wrap type ${block.type}`);
  }
}

/**
 * Prepends the list of statements to the provided expression and returns it.
 */
function prependExpression(block: Expression, expr: Expression): SequenceExpression {
  return {
    type: 'SequenceExpression',
    expressions: [expr, block],
  };
}

/**
 * The Instrumenter transforms JavaScript code adding coverage measurements
 * as described in AFL's whitepaper here:
 * http://lcamtuf.coredump.cx/afl/technical_details.txt
 */
@injectable()
export class ConverageInstrumentor {
  private idCounter = 0;
  private detachFn?: () => void;

  constructor(
    @inject(Types.HookManager) private readonly hooks: HookManager,
    @inject(Types.Runtime) private readonly runtime: Runtime,
  ) {}

  /**
   * Hooks the instrumenter into the require() statement.
   */
  public attach() {
    this.runtime.install();
    return this.hooks.hookRequire(code => this.instrument(code));
  }

  /**
   * Detaches the instrumenter from intercepting new code.
   */
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
   * Walks and instruments the AST tree.
   */
  private instrumentBranches(stmt: Node) {
    switch (stmt.type) {
      case 'IfStatement':
        stmt.consequent = prependBlock(ensureBlock(stmt.consequent), this.branch());
        stmt.alternate = stmt.alternate && prependBlock(ensureBlock(stmt.alternate), this.branch());
        return stmt;
      case 'ConditionalExpression':
        stmt.consequent = prependExpression(stmt.consequent, this.branch());
        stmt.alternate = prependExpression(stmt.alternate, this.branch());
        return stmt;
      case 'LogicalExpression':
        stmt.left = prependExpression(stmt.left, this.branch());
        stmt.right = prependExpression(stmt.right, this.branch());
        return stmt;
      case 'SwitchCase':
        stmt.consequent = [
          { type: 'ExpressionStatement', expression: this.branch() },
          ...stmt.consequent,
        ];
        return stmt;
      default:
        return stmt;
    }
  }

  private branch() {
    const id = createCoverageId(this.idCounter++);
    return this.runtime.call('coverage', 'increment', {
      type: 'Literal',
      value: id,
      raw: String(id),
    });
  }
}
