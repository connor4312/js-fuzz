#!/usr/bin/env node

'use strict'

process.env.TERM = 'windows-ansi' // hack for Cygwin/conemu

const Cluster = require('../lib/src/Cluster').Cluster
const parseDuration = require('parse-duration')
const path = require('path')
const os = require('os')

const argv = require('yargs')
  .usage('Usage: $0 <file> [--exclude package1 package2]')
  .demandCommand(1, 'Please specify a file to fuzz')
  .options({
    e: {
      alias: 'exclude',
      describe: 'List of package regexes that will be excluded from coverage analysis',
      type: 'array',
      default: []
    },
    w: {
      alias: 'workers',
      describe: 'The number of workers to spawn to run fuzzing.',
      default: os.cpus().length
    },
    q: {
      alias: 'quiet',
      describe: 'Hide the stats output',
      default: false
    },
    t: {
      alias: 'timeout',
      type: 'string',
      default: '100ms',
      describe: 'Duration we wait before failing (timing out) test input.',
    },
  })
  .argv;

const c = new Cluster({
  target: path.resolve(process.cwd(), argv._[0]),
  exclude: argv.exclude,
  workers: argv.workers,
  quiet: argv.quiet,
  timeout: parseDuration(argv.timeout),
})

if (argv.quiet) {
  c.on('error', err => console.error(err.stack || err.message))
  c.on('warn', message => console.error(message))
}

c.start()
