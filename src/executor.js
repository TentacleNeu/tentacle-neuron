import { spawn } from 'child_process';
import { loadConfig } from './config.js';

// 获取配置中的 Bash 路径，或使用默认值
const config = loadConfig();
const BASH_PATH = process.platform === 'win32'
  ? (process.env.CLAUDE_CODE_GIT_BASH_PATH || config.settings?.bash_path || 'C:\\Program Files\\Git\\bin\\bash.exe')
  : '/bin/bash';

export async function executeTask(agentConfig, task) {
  console.log(`🚀 Preparing execution for task ${task.id}...`);

  const fullCommand = buildCommand(agentConfig, task);
  console.log(`📝 Full Command: ${fullCommand.substring(0, 100)}...`);
  console.log(`🐚 Using shell: ${BASH_PATH}`);

  const start = Date.now();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const child = spawn(BASH_PATH, ['-c', fullCommand], {
      stdio: ['inherit', 'pipe', 'pipe'],
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
    const timeoutMs = (agentConfig.timeout || 300) * 1000;
    const timer = setTimeout(() => {
      console.error(`⏰ Task timed out after ${agentConfig.timeout || 300}s`);
      child.kill();
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);
      const duration = Date.now() - start;
      console.log(`🏁 Agent exited in ${duration}ms (code: ${code})`);

      // 过滤掉环境噪音
      const cleanOutput = stdout
        .split('\n')
        .filter(line => !line.includes('cygpath') && line.trim())
        .join('\n')
        .trim();

      console.log(`📄 Result preview: ${cleanOutput.substring(0, 100)}...`);

      resolve({
        success: code === 0 || cleanOutput.length > 0,
        output: cleanOutput || stderr,
        timestamp: Date.now()
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      console.error(`❌ Spawn error:`, err.message);
      resolve({
        success: false,
        output: '',
        error: err.message,
        timestamp: Date.now()
      });
    });
  });
}

function buildCommand(agent, task) {
  const escapedPrompt = task.prompt.replace(/"/g, '\\"').replace(/\n/g, ' ');

  switch (agent.type) {
    case 'claude':
      return `${agent.command} ${agent.args || ''} --print "${escapedPrompt}"`;
    case 'aider':
      return `${agent.command} --message "${escapedPrompt}" --yes`;
    case 'openai':
      return `${agent.command} api chat.completions.create -m gpt-4 -g user "${escapedPrompt}"`;
    default:
      throw new Error(`Unknown agent type: ${agent.type}`);
  }
}
