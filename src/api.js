import { randomUUID } from 'crypto';
import { loadConfig } from './config.js';

const config = loadConfig();
const SERVER_URL = config.settings?.server_url || 'http://localhost:3000';

const submittedTasks = new Set();

export async function register(wallet, skills) {
  try {
    const token = config.token;
    if (!token) {
      console.error('Missing token in config.yaml. Please add your email as token.');
      return null;
    }

    const modelTier = config.agent?.model_tier || 'medium';
    const acceptLowerTier = config.settings?.accept_lower_tier ?? true;

    const res = await fetch(`${SERVER_URL}/api/neurons/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, skills, token, modelTier, acceptLowerTier })
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`Registration failed: ${data.error}`);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to register:', error.message);
    return null;
  }
}

export async function pollTasks(neuronId) {
  try {
    const res = await fetch(`${SERVER_URL}/api/tasks/poll?neuronId=${neuronId}&status=idle`);
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) {
        console.error('Neuron not registered. Please restart to re-register.');
      }
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

export async function submitResult(taskId, neuronId, result, error = null, meta = undefined) {
  if (submittedTasks.has(taskId)) {
    const shortId = taskId ? taskId.substring(0, 8) : 'unknown';
    console.log(`Task ${shortId} already submitted, skipping duplicate`);
    return { status: 'duplicate_skipped' };
  }

  try {
    const idempotencyKey = randomUUID();
    const body = {
      taskId,
      neuronId,
      result,
      error
    };

    if (meta) {
      body.meta = meta;
    }

    const res = await fetch(`${SERVER_URL}/api/tasks/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      submittedTasks.add(taskId);
    }

    return await res.json();
  } catch (err) {
    console.error('Failed to submit result:', err.message);
    return null;
  }
}
