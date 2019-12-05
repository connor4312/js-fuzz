# Architecture

This package is a low-level API for starting and monitoring fuzzing operations.

1. It takes a Node.js script to import and run. The first thing the package does is hook into Node's `require`, and it then import the target script. It observes the packages it imports and uses the literals found in the source code--strings, numbers, regular expressions--to seed its corpus with interesting data.

2. We want to use the whole CPU for our fuzzing, but Javascript only runs on one core. For this, we use worker processes. The package spawns several worker processes, which talk back to the parent process via grpc. The communication is defined in `rpc.proto`. Generally, each worker process operates fairly independently (they randomly mutate input, test things, on their own) with the coordinator being a fairly simple stash of state.

3. The worker processes hook into `require` again before importing the target script. The transform code using esprima to add coverage telemetry and to add breakpoints around loops so that we can avoid processes hanging.
