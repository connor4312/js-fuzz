#!/usr/bin/env node

'use strict';

process.env.TERM = 'windows-ansi'; // hack for Cygwin/conemu

import { Instrumenter, ClusterFactory, StatType } from 'js-fuzz-core';
import * as yargs from 'yargs';
import * as path from 'path';
import { cpus } from 'os';
import { readFileSync } from 'fs';
import { ReporterType, reporters } from './reporters';

yargs
  .env('JS_FUZZ')
  .command(
    'fuzz <file>',
    'Fuzz a file',
    builder =>
      builder
        .positional('file', {
          describe: 'File to fuzz',
          type: 'string',
          required: true,
        })
        .option('exclude', {
          alias: 'e',
          describe: 'List of package regexes that will be excluded from coverage analysis',
          type: 'array',
          default: [] as string[],
        })
        .option('workers', {
          alias: 'w',
          default: cpus().length,
          describe: 'Number of worker processes to run',
          type: 'count',
        })
        .option('timeout', {
          alias: 't',
          default: 100,
          describe: 'Number of milliseconds after which to fail tests if it does not return',
          type: 'count',
        })
        .option('reporter', {
          alias: 'r',
          describe: 'Output formatter',
          type: 'string',
          choices: Object.values(ReporterType),
          default: ReporterType.Json,
        }),
    argv => {
      const c = new ClusterFactory({
        target: path.resolve(process.cwd(), argv.file!),
        exclude: argv.exclude,
        workers: argv.workers,
        timeout: argv.timeout,
      }).start();

      const reporter = reporters[argv.reporter]();
      process.once('SIGINT', () => c.shutdown('SIGINT'));
      process.once('SIGTERM', () => c.shutdown('SIGTERM'));

      c.stats.subscribe(stats => {
        reporter.write(stats);

        if (stats.type === StatType.FatalError) {
          process.exit(1);
        }

        if (stats.type === StatType.ShutdownComplete) {
          process.exit(0);
        }
      });
    },
  )
  .command(
    'instrument <file>',
    'Prints the instrumented source of the given file',
    builder =>
      builder
        .positional('file', {
          describe: 'File to instrument.',
          type: 'string',
          default: '-',
        })
        .option('hashBits', {
          describe: 'Hashmap size in bits',
          type: 'number',
          default: 16,
        })
        .options('deterministicKeys', {
          describe: 'Use deterministic keys for branch tagging',
          type: 'boolean',
          default: false,
        })
        .options('hashName', {
          describe: 'Global variable name to store the hashmap in',
          type: 'string',
          default: '__coverage__',
        }),
    argv => {
      const contents = readFileSync(argv.file === '-' ? 0 : argv.file, 'utf-8');
      const result = new Instrumenter().instrument(contents);
      process.stdout.write(result);
    },
  )
  .strict()
  .help()
  .parse();
