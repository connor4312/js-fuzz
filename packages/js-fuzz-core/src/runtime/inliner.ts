import { Expression, MemberExpression } from 'estree';

export interface IInliningContext {
  accessOwnProperty(property: string): MemberExpression;
}

/**
 * Type that can be exposed in the Runtime services which, when inserted in
 * generated code, will inline the generated expression instead of creating a
 * method call. Used for hot-path optimization.
 */
export class Inliner {
  constructor(
    public readonly generator: (context: IInliningContext, ...args: Expression[]) => Expression,
  ) {}
}
