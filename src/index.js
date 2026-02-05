import { loadConfig } from './config.js';
import { executeTask } from './executor.js';
import * as api from './api.js';
import 'dotenv/config';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withJitter(ms, ratio = 0.2) {
  const jitter = ms * ratio;
  return Math.max(0, Math.floor(ms - jitter + Math.random() * jitter * 2));
}

async function registerWithRetry(config) {
  const baseDelayMs = 1000;
  const maxDelayMs = config.settings?.register_backoff_max_ms || config.settings?.poll_backoff_max_ms || 30000;
  let delayMs = baseDelayMs;

  for (;;) {
    const regResult = await api.register(config.wallet, config.skills);
    if (regResult?.id) {
      return regResult;
    }

    delayMs = Math.min(maxDelayMs, Math.floor(delayMs * 1.5));
    console.error(`Registration failed. Retrying in ${Math.round(delayMs / 1000)}s...`);
    await sleep(withJitter(delayMs));
  }
}

function buildStatsReporter(stats, intervalMs) {
  if (!intervalMs || intervalMs <= 0) return null;

  return setInterval(() => {
    const successRate = stats.received > 0
      ? ((stats.succeeded / stats.received) * 100).toFixed(1)
      : '0.0';
    const avgDuration = stats.completed > 0
      ? Math.round(stats.totalDurationMs / stats.completed)
      : 0;

    console.log(`[Stats] received=${stats.received} completed=${stats.completed} success=${stats.succeeded} failed=${stats.failed} timeout=${stats.timedOut} successRate=${successRate}% avgDurationMs=${avgDuration}`);
  }, intervalMs);
}

async function main() {
  console.log('Tentacle Neuron Starting...');

  const config = loadConfig();
  console.log(`Loaded config for wallet: ${config.wallet}`);
  console.log(`Agent: ${config.agent.type}`);
  console.log(`Server: ${config.settings.server_url}`);

  console.log('Connecting to Brain...');
  const regResult = await registerWithRetry(config);

  const neuronId = regResult.id;
  console.log(`Registered Neuron ID: ${neuronId}`);
  console.log('Waiting for tasks...');

  const activeTasks = new Set();
  const maxConcurrent = config.settings?.max_concurrent || 1;
  console.log(`Concurrency Level: ${maxConcurrent}`);

  const stats = {
    received: 0,
    completed: 0,
    succeeded: 0,
    failed: 0,
    timedOut: 0,
    totalDurationMs: 0
  };

  const statsIntervalMs = config.settings?.stats_interval_ms;
  buildStatsReporter(stats, statsIntervalMs);

  const baseIntervalMs = config.settings?.poll_interval || 5000;
  const maxBackoffMs = config.settings?.poll_backoff_max_ms || 30000;
  let backoffMs = baseIntervalMs;
  let pollInFlight = false;

  const scheduleNext = () => {
    setTimeout(pollOnce, withJitter(backoffMs));
  };

  const pollOnce = async () => {
    if (pollInFlight) {
      scheduleNext();
      return;
    }

    if (activeTasks.size >= maxConcurrent) {
      backoffMs = baseIntervalMs;
      scheduleNext();
      return;
    }

    pollInFlight = true;

    try {
      const pollResult = await api.pollTasks(neuronId);

      if (pollResult && pollResult.task) {
        backoffMs = baseIntervalMs;

        const task = pollResult.task;
        const taskId = task.id || 'unknown';
        const logPrefix = `[Task ${taskId.substring(0, 8)}]`;
        const preview = task.prompt ? task.prompt.substring(0, 80) : '';
        console.log(`${logPrefix} Received Task: ${preview}...`);

        activeTasks.add(taskId);
        stats.received += 1;

        executeTask(config.agent, task)
          .then(async (result) => {
            const outputText = typeof result.output === 'string' ? result.output : JSON.stringify(result.output);
            const meta = {
              success: result.success,
              output: outputText,
              error: result.error || null,
              durationMs: result.durationMs,
              workDir: result.workDir || null,
              level: task.level || null
            };

            const submitResult = config.settings?.submit_meta ? meta : outputText;
            const submitError = result.success ? null : result.error;

            console.log(`${logPrefix} Submitting result...`);
            await api.submitResult(taskId, neuronId, submitResult, submitError, config.settings?.submit_meta ? meta : undefined);
            console.log(`${logPrefix} Task completed & submitted.`);

            stats.completed += 1;
            if (result.success) {
              stats.succeeded += 1;
            } else {
              stats.failed += 1;
              if (result.error && result.error.includes('timed out')) {
                stats.timedOut += 1;
              }
            }
            if (result.durationMs) {
              stats.totalDurationMs += result.durationMs;
            }
          })
          .catch(async (err) => {
            console.error(`${logPrefix} Critical error executing task:`, err);
            await api.submitResult(taskId, neuronId, null, err.message);
            stats.completed += 1;
            stats.failed += 1;
          })
          .finally(() => {
            activeTasks.delete(taskId);
            console.log(`Slot freed. Active tasks: ${activeTasks.size}/${maxConcurrent}`);
          });
      } else {
        backoffMs = Math.min(maxBackoffMs, Math.floor(backoffMs * 1.5));
      }
    } catch {
      backoffMs = Math.min(maxBackoffMs, Math.floor(backoffMs * 1.5));
    } finally {
      pollInFlight = false;
      scheduleNext();
    }
  };

  scheduleNext();
}

main().catch((err) => {
  console.error('Fatal error:', err);
});
