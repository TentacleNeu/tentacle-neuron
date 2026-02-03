import { loadConfig } from './config.js';

const config = loadConfig();
const SERVER_URL = config.settings?.server_url || 'http://localhost:3000';

export async function register(wallet, skills) {
  try {
    const res = await fetch(`${SERVER_URL}/api/neurons/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, skills })
    });
    return await res.json();
  } catch (error) {
    console.error('❌ Failed to register:', error.message);
    return null;
  }
}

export async function pollTasks(neuronId) {
  try {
    const res = await fetch(`${SERVER_URL}/api/tasks/poll?neuronId=${neuronId}&status=idle`);
    return await res.json();
  } catch (error) {
    // Silent fail on poll errors to avoid log spam
    return null;
  }
}

export async function submitResult(taskId, neuronId, result, error = null) {
  try {
    const res = await fetch(`${SERVER_URL}/api/tasks/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        neuronId,
        result,
        error
      })
    });
    return await res.json();
  } catch (error) {
    console.error('❌ Failed to submit result:', error.message);
    return null;
  }
}
