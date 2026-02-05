import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, mkdtempSync, rmdirSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { loadConfig } from './config.js';

const config = loadConfig();
const BASH_PATH = process.platform === 'win32'
  ? (process.env.CLAUDE_CODE_GIT_BASH_PATH || config.settings?.bash_path || 'C:\\Program Files\\Git\\bin\\bash.exe')
  : '/bin/bash';

export async function executeTask(agentConfig, task) {
  const logPrefix = `[Task ${task.id.substring(0, 8)}]`;
  console.log(`${logPrefix} Preparing execution...`);

  const tempDir = mkdtempSync(join(tmpdir(), 'tentacle-'));
  const promptFile = join(tempDir, 'prompt.txt');
  writeFileSync(promptFile, task.prompt || '', 'utf-8');
  console.log(`${logPrefix} Prompt saved to temp file: ${promptFile}`);

  const workDir = resolveWorkDir(task, config);
  if (workDir) {
    console.log(`${logPrefix} Work dir: ${workDir}`);
  }

  const fullCommand = buildCommand(agentConfig, promptFile, workDir, config);
  console.log(`${logPrefix} Full command: ${fullCommand.substring(0, 120)}...`);
  console.log(`${logPrefix} Using shell: ${BASH_PATH}`);

  const start = Date.now();

  const taskTimeoutSeconds = task.timeoutMinutes ? task.timeoutMinutes * 60 : null;
  const timeoutSeconds = taskTimeoutSeconds || agentConfig.timeout || 300;
  const timeoutMs = timeoutSeconds * 1000;
  console.log(`${logPrefix} Timeout: ${timeoutSeconds}s (${task.timeoutMinutes || 'default'} min)`);

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn(BASH_PATH, ['-c', fullCommand], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CLAUDE_CODE_GIT_BASH_PATH: BASH_PATH
      }
    });

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      timedOut = true;
      console.error(`${logPrefix} Task timed out after ${timeoutSeconds}s`);
      child.kill();
    }, timeoutMs);

    const cleanup = () => {
      try {
        unlinkSync(promptFile);
        rmdirSync(tempDir);
      } catch {
        // ignore cleanup errors
      }
    };

    child.on('close', (code) => {
      clearTimeout(timer);
      cleanup();
      const duration = Date.now() - start;
      console.log(`${logPrefix} Agent exited in ${duration}ms (code: ${code})`);

      const cleanOutput = stdout
        .split('\n')
        .filter((line) => !line.includes('cygpath') && line.trim())
        .join('\n')
        .trim();

      console.log(`${logPrefix} Result preview: ${cleanOutput.substring(0, 120)}...`);

      resolve({
        success: !timedOut && code === 0,
        output: cleanOutput || stderr,
        error: timedOut
          ? 'Task execution timed out'
          : (code !== 0 ? `Agent exited with code ${code}` : undefined),
        durationMs: duration,
        timestamp: Date.now(),
        workDir
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      cleanup();
      console.error(`${logPrefix} Spawn error:`, err.message);
      resolve({
        success: false,
        output: '',
        error: err.message,
        durationMs: Date.now() - start,
        timestamp: Date.now(),
        workDir
      });
    });
  });
}

function buildCommand(agent, promptFile, workDir, fullConfig) {
  const safePromptFile = promptFile.replace(/\\/g, '/');
  const safeWorkDir = workDir ? workDir.replace(/\\/g, '/') : null;
  const cdPrefix = safeWorkDir ? `cd "${safeWorkDir}" && ` : '';

  switch (agent.type) {
    case 'claude':
      return `${cdPrefix}cat "${safePromptFile}" | ${agent.command} ${normalizeClaudeArgs(agent.args, fullConfig)} --print -`;
    case 'aider':
      return `${cdPrefix}${agent.command} --message-file "${safePromptFile}" --yes`;
    case 'openai':
      const model = agent.model || 'gpt-4';
      return `${cdPrefix}cat "${safePromptFile}" | ${agent.command} api chat.completions.create -m ${model} -g user -`;
    default:
      throw new Error(`Unknown agent type: ${agent.type}`);
  }
}

function resolveWorkDir(task, fullConfig) {
  const candidates = [
    task?.workDir,
    task?.projectPath,
    task?.repoPath,
    fullConfig.settings?.default_work_dir,
    process.cwd()
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'string') continue;
    const resolved = resolve(candidate);
    if (existsSync(resolved)) {
      try {
        if (statSync(resolved).isDirectory()) {
          return resolved;
        }
      } catch {
        // ignore
      }
    }
  }

  return null;
}

function normalizeClaudeArgs(args, fullConfig) {
  const allowDangerous = fullConfig.settings?.allow_dangerous === true;
  if (!args || typeof args !== 'string') {
    return allowDangerous ? '--dangerously-skip-permissions' : '';
  }

  if (allowDangerous) {
    return args.trim();
  }

  const filtered = args
    .split(/\s+/)
    .filter((arg) => arg !== '--dangerously-skip-permissions')
    .join(' ')
    .trim();

  return filtered;
}