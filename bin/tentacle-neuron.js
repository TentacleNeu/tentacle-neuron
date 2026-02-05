#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mainScript = join(__dirname, '..', 'src', 'index.js');
const doctorScript = join(__dirname, '..', 'src', 'doctor.js');

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'start':
  case undefined:
    import(mainScript);
    break;

  case 'init':
    console.log('Tentacle Neuron Setup');
    console.log('=====================');
    console.log('Create a config.yaml file with your settings.');
    console.log('See config.example.yaml for reference.');
    break;

  case 'doctor':
    import(doctorScript);
    break;

  case 'version':
  case '-v':
  case '--version':
    const pkg = await import('../package.json', { assert: { type: 'json' } });
    console.log(`tentacle-neuron v${pkg.default.version}`);
    break;

  case 'help':
  case '-h':
  case '--help':
    console.log(`
Tentacle Neuron - Distributed AI Agent Worker

Usage:
  tentacle-neuron [command]

Commands:
  start       Start the neuron (default)
  init        Initialize configuration
  doctor      Run health checks
  version     Show version
  help        Show this help

Examples:
  tentacle-neuron start
  tentacle-neuron doctor
`);
    break;

  default:
    console.error(`Unknown command: ${command}`);
    console.error('Run "tentacle-neuron help" for usage.');
    process.exit(1);
}