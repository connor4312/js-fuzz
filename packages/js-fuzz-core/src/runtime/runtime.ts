import { Expression, MemberExpression } from 'estree';
import { IRuntimeServices, RuntimeServiceCollection } from './runtime-service-collection';
import { inject, injectable } from 'inversify';
import * as Types from '../dependencies';
import { Inliner } from './inliner';

/**
 * Global name for the runtime variable the Runtime instance is stored in.
 */
const globalName = '__js_fuzz_';

declare const global: { [key: string]: any };

@injectable()
export class Runtime {
  constructor(
    @inject(Types.RuntimeServiceCollection)
    public readonly services: RuntimeServiceCollection,
  ) {}

  /**
   * Installs the runtime global.
   */
  public install() {
    global[globalName] = this;
  }

  /**
   * Resets all services.
   */
  public reset() {
    this.services.reset();
  }

  /**
   * Creates an ES node that calls an expression on the runtime.
   */
  public call<K extends keyof IRuntimeServices>(
    service: K,
    method: keyof {
      [J in keyof IRuntimeServices[K]]: IRuntimeServices[K][J] extends
        | ((...args: Expression[]) => Expression)
        | Inliner
        ? true
        : never
    },
    ...args: Expression[]
  ): Expression {
    const implementation = this.services[service][method];
    if (implementation instanceof Inliner) {
      return implementation.generator(
        { accessOwnProperty: prop => this.createPropertyAccess(service, prop as any) },
        ...args,
      );
    }

    return {
      type: 'CallExpression',
      callee: this.createPropertyAccess(service, method),
      arguments: args,
    };
  }

  private createPropertyAccess<K extends keyof IRuntimeServices>(
    service: K,
    method: keyof {
      [J in keyof IRuntimeServices[K]]: IRuntimeServices[K][J] extends
        | ((...args: Expression[]) => Expression)
        | Inliner
        ? true
        : never
    },
  ): MemberExpression {
    return {
      type: 'MemberExpression',
      computed: false,
      object: {
        type: 'MemberExpression',
        computed: false,
        object: {
          type: 'Identifier',
          name: globalName,
        },
        property: {
          type: 'Identifier',
          name: service,
        },
      },
      property: {
        type: 'Identifier',
        name: method as string,
      },
    };
  }
}
