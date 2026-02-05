import { randomUUID } from 'crypto';
import { loadConfig } from './config.js';

const config = loadConfig();
const SERVER_URL = config.settings?.server_url || 'http://localhost:3000';

// 任务级幂等键缓存（防止同一任务重复提交）
const submittedTasks = new Set();

export async function register(wallet, skills) {
  try {
    const token = config.token;
    if (!token) {
      console.error('❌ Missing token in config.yaml. Please add your email as token.');
      return null;
    }

    // 从配置中读取 model_tier 和 accept_lower_tier
    const modelTier = config.agent?.model_tier || 'medium';
    const acceptLowerTier = config.settings?.accept_lower_tier ?? true;

    const res = await fetch(`${SERVER_URL}/api/neurons/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, skills, token, modelTier, acceptLowerTier })
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`❌ Registration failed: ${data.error}`);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ Failed to register:', error.message);
    return null;
  }
}

export async function pollTasks(neuronId) {
  try {
    const res = await fetch(`${SERVER_URL}/api/tasks/poll?neuronId=${neuronId}&status=idle`);
    const data = await res.json();

    if (!res.ok) {
      // Neuron 未注册或其他错误
      if (res.status === 401) {
        console.error('❌ Neuron not registered. Please restart to re-register.');
      }
      return null;
    }

    return data;
  } catch (error) {
    // Silent fail on poll errors to avoid log spam
    return null;
  }
}

export async function submitResult(taskId, neuronId, result, error = null) {
  // 幂等性检查：同一 taskId 只提交一次
  if (submittedTasks.has(taskId)) {
    console.log(`⚠️ Task ${taskId.substring(0, 8)} already submitted, skipping duplicate`);
    return { status: 'duplicate_skipped' };
  }

  try {
    const idempotencyKey = randomUUID();
    const res = await fetch(`${SERVER_URL}/api/tasks/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey  // 供 Brain 端未来使用
      },
      body: JSON.stringify({
        taskId,
        neuronId,
        result,
        error
      })
    });

    if (res.ok) {
      submittedTasks.add(taskId);  // 标记已提交
    }

    return await res.json();
  } catch (err) {
    console.error('❌ Failed to submit result:', err.message);
    return null;
  }
}
