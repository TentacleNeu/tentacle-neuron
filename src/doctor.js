import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { loadConfig } from './config.js';

const config = loadConfig();
const BASH_PATH = process.platform === 'win32'
  ? (process.env.CLAUDE_CODE_GIT_BASH_PATH || config.settings?.bash_path || 'C:\\Program Files\\Git\\bin\\bash.exe')
  : '/bin/bash';

const checks = [];
let hasErrors = false;

function record(ok, label, details = '') {
  checks.push({ ok, label, details });
  if (!ok) hasErrors = true;
}

function checkConfig() {
  record(Boolean(config.wallet), 'wallet configured', config.wallet ? '' : 'Missing wallet');
  record(Boolean(config.token), 'token configured', config.token ? '' : 'Missing token (email)');
  record(Boolean(config.settings?.server_url), 'server_url configured', config.settings?.server_url || 'Missing server_url');
}

function checkBash() {
  if (process.platform !== 'win32') return;
  record(existsSync(BASH_PATH), 'Git Bash path', BASH_PATH);
}

function checkAgentCommand() {
  const command = config.agent?.command;
  if (!command) {
    record(false, 'agent command configured', 'Missing agent.command');
    return;
  }

  if (process.platform === 'win32' && !existsSync(BASH_PATH)) {
    record(false, 'agent command available', `Git Bash not found at ${BASH_PATH}`);
    return;
  }

  const result = spawnSync(BASH_PATH, ['-c', `command -v ${command}`], { encoding: 'utf-8' });
  const found = result.status === 0 && result.stdout.trim().length > 0;
  record(found, 'agent command available', found ? result.stdout.trim() : command);
}

function checkWorkDir() {
  const defaultWorkDir = config.settings?.default_work_dir;
  if (!defaultWorkDir) return;
  record(existsSync(defaultWorkDir), 'default_work_dir exists', defaultWorkDir);
}

function printReport() {
  console.log('Tentacle Neuron Doctor');
  console.log('======================');
  for (const check of checks) {
    const status = check.ok ? '[OK]' : '[FAIL]';
    const line = `${status} ${check.label}${check.details ? ` -> ${check.details}` : ''}`;
    console.log(line);
  }

  if (hasErrors) {
    console.log('');
    console.log('Doctor found issues. Fix the failures and retry.');
    process.exit(1);
  }

  console.log('');
  console.log('Doctor checks passed.');
}

checkConfig();
checkBash();
checkAgentCommand();
checkWorkDir();
printReport();
