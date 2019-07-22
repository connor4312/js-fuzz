import { Container } from "inversify";

export const FuzzOptions = Symbol('FuzzOptions');
export const ClusterFactory = Symbol('ClusterFactory');

export const HookManager = Symbol('HookManager');
export const LiteralExtractor = Symbol('LiteralExtractor');
export const CoverageInstrumentor = Symbol('CoverageInstrumentor');

export const MutationAlgorithms = Symbol('MutationAlgorithms');
export const Mutator = Symbol('Mutator');

export const CoverageHashService = Symbol('CoverageHashService');
export const RuntimeServiceCollection = Symbol('RuntimeServiceCollection');
export const Runtime = Symbol('Runtime');

export const createContainer = () => {
  const container = new Container();

  // Things are dynamically required() so that we can boot up quickly and not
  // require things we don't need in worker processes.

  container
    .bind(HookManager)
    .toDynamicValue(ctx =>
      ctx.container.resolve(require('./instrumentation/hook-manager').HookManager),
    )
    .inSingletonScope();

  container
    .bind(CoverageInstrumentor)
    .toDynamicValue(ctx =>
      ctx.container.resolve(require('./instrumentation/coverage-instrumentor').ConverageInstrumentor)
    )
    .inSingletonScope();

  container
    .bind(LiteralExtractor)
    .toDynamicValue(ctx =>
      ctx.container.resolve(require('./instrumentation/literal-extractor').LiteralExtractor)
    )
    .inSingletonScope();

  container
    .bind(MutationAlgorithms)
    .toDynamicValue(ctx =>
      ctx.container.resolve(require('./mutations/algorithms').mutators)
    )
    .inSingletonScope();

  container
    .bind(Mutator)
    .toDynamicValue(ctx =>
      ctx.container.resolve(require('./mutations/mutator').Mutator)
    )
    .inSingletonScope();

  container
    .bind(ClusterFactory)
    .toDynamicValue(ctx =>
      ctx.container.resolve(require('./cluster-factory').ClusterFactory)
    )
    .inSingletonScope();

  container
    .bind(CoverageHashService)
    .toDynamicValue(ctx =>
      ctx.container.resolve(require('./runtime/coverage-hash').CoverageHash)
    )
    .inSingletonScope();

  container
    .bind(RuntimeServiceCollection)
    .toDynamicValue(ctx =>
      ctx.container.resolve(require('./runtime/runtime-service-collection').RuntimeServiceCollection)
    )
    .inSingletonScope();

  container
    .bind(Runtime)
    .toDynamicValue(ctx =>
      ctx.container.resolve(require('./runtime/runtime').Runtime)
    )
    .inSingletonScope();

    return container;
};
