import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, mkdtempSync, rmdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadConfig } from './config.js';

// 获取配置中的 Bash 路径，或使用默认值
const config = loadConfig();
const BASH_PATH = process.platform === 'win32'
  ? (process.env.CLAUDE_CODE_GIT_BASH_PATH || config.settings?.bash_path || 'C:\\Program Files\\Git\\bin\\bash.exe')
  : '/bin/bash';

export async function executeTask(agentConfig, task) {
  const logPrefix = `[Task ${task.id.substring(0, 8)}]`;
  console.log(`${logPrefix} 🚀 Preparing execution...`);

  // 安全处理：将 prompt 写入临时文件，避免命令注入
  const tempDir = mkdtempSync(join(tmpdir(), 'tentacle-'));
  const promptFile = join(tempDir, 'prompt.txt');
  writeFileSync(promptFile, task.prompt, 'utf-8');
  console.log(`${logPrefix} 📝 Prompt saved to temp file: ${promptFile}`);

  const fullCommand = buildCommand(agentConfig, promptFile);
  console.log(`${logPrefix} 📝 Full Command: ${fullCommand.substring(0, 100)}...`);
  console.log(`${logPrefix} 🐚 Using shell: ${BASH_PATH}`);

  const start = Date.now();

  // 使用任务指定的超时时间，如果没有则使用 agent 配置，最后使用默认值
  const taskTimeoutSeconds = task.timeoutMinutes ? task.timeoutMinutes * 60 : null;
  const timeoutSeconds = taskTimeoutSeconds || agentConfig.timeout || 300;
  const timeoutMs = timeoutSeconds * 1000;
  console.log(`${logPrefix} ⏱️ Timeout: ${timeoutSeconds}s (${task.timeoutMinutes || 'default'} min)`);

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn(BASH_PATH, ['-c', fullCommand], {
      stdio: ['ignore', 'pipe', 'pipe'],  // stdin 设为 ignore，防止子进程阻塞等待输入
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

    // 超时处理
    const timer = setTimeout(() => {
      timedOut = true;
      console.error(`${logPrefix} ⏰ Task timed out after ${timeoutSeconds}s`);
      child.kill();
    }, timeoutMs);

    const cleanup = () => {
      // 清理临时文件和目录
      try {
        unlinkSync(promptFile);
        rmdirSync(tempDir);  // 删除临时目录
      } catch (e) {
        // 忽略清理错误
      }
    };

    child.on('close', (code) => {
      clearTimeout(timer);
      cleanup();
      const duration = Date.now() - start;
      console.log(`${logPrefix} 🏁 Agent exited in ${duration}ms (code: ${code})`);

      // 过滤掉环境噪音
      const cleanOutput = stdout
        .split('\n')
        .filter(line => !line.includes('cygpath') && line.trim())
        .join('\n')
        .trim();

      console.log(`${logPrefix} 📄 Result preview: ${cleanOutput.substring(0, 100)}...`);

      resolve({
        success: !timedOut && code === 0,  // 仅 exit code 0 视为成功
        output: cleanOutput || stderr,
        error: timedOut
          ? 'Task execution timed out'
          : (code !== 0 ? `Agent exited with code ${code}` : undefined),
        timestamp: Date.now()
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      cleanup();
      console.error(`${logPrefix} ❌ Spawn error:`, err.message);
      resolve({
        success: false,
        output: '',
        error: err.message,
        timestamp: Date.now()
      });
    });
  });
}

function buildCommand(agent, promptFile) {
  // 使用文件路径代替直接拼接 prompt，防止命令注入
  const safePromptFile = promptFile.replace(/\\/g, '/');  // Windows 路径转换

  switch (agent.type) {
    case 'claude':
      // Claude CLI 支持从文件读取
      return `cat "${safePromptFile}" | ${agent.command} ${agent.args || ''} --print -`;
    case 'aider':
      return `${agent.command} --message-file "${safePromptFile}" --yes`;
    case 'openai':
      const model = agent.model || 'gpt-4';  // 从配置读取模型，默认 gpt-4
      return `cat "${safePromptFile}" | ${agent.command} api chat.completions.create -m ${model} -g user -`;
    default:
      throw new Error(`Unknown agent type: ${agent.type}`);
  }
}
