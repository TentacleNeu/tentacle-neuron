import { loadConfig } from './config.js';
import { executeTask } from './executor.js';
import * as api from './api.js';
import 'dotenv/config';

async function main() {
  console.log('🐙 Tentacle Neuron Starting...');

  // 1. Load Config
  const config = loadConfig();
  console.log(`✅ Loaded config for wallet: ${config.wallet}`);
  console.log(`🤖 Agent: ${config.agent.type}`);
  console.log(`📡 Server: ${config.settings.server_url}`);

  // 2. Register with Brain
  console.log('📡 Connecting to Brain...');
  const regResult = await api.register(config.wallet, config.skills);

  if (!regResult || !regResult.id) {
    console.error('❌ Registration failed. Retrying in 5s...');
    setTimeout(main, 5000);
    return;
  }

  const neuronId = regResult.id;
  console.log(`🆔 Registered Neuron ID: ${neuronId}`);
  console.log('💤 Waiting for tasks...\n');

  // 3. Main Loop
  const activeTasks = new Set();
  const maxConcurrent = config.settings?.max_concurrent || 1;
  console.log(`🧵 Concurrency Level: ${maxConcurrent}`);

  setInterval(async () => {
    // Check if we have free slots
    if (activeTasks.size >= maxConcurrent) {
      return; 
    }

    // Poll for task
    // Note: In a real high-concurrency scenario, you might want to fetch multiple tasks at once.
    // For now, we fetch one by one to fill the slots.
    const pollResult = await api.pollTasks(neuronId);

    if (pollResult && pollResult.task) {
      const task = pollResult.task;
      const logPrefix = `[Task ${task.id.substring(0, 8)}]`;
      console.log(`${logPrefix} 📦 Received Task: ${task.prompt.substring(0, 50)}...`);

      // Add to active set
      activeTasks.add(task.id);

      // Execute asynchronously (FIRE AND FORGET from the loop's perspective)
      // We do NOT await here, so the loop can continue to fetch more tasks
      executeTask(config.agent, task)
        .then(async (result) => {
          console.log(`${logPrefix} 📤 Submitting result...`);
          await api.submitResult(task.id, neuronId, result.output, result.success ? null : result.error);
          console.log(`${logPrefix} ✅ Task completed & submitted.`);
        })
        .catch(async (err) => {
          console.error(`${logPrefix} ❌ Critical error executing task:`, err);
          await api.submitResult(task.id, neuronId, null, err.message);
        })
        .finally(() => {
          // Free up the slot
          activeTasks.delete(task.id);
          console.log(`💤 Slot freed. Active tasks: ${activeTasks.size}/${maxConcurrent}`);
        });
    }
  }, config.settings.poll_interval || 5000);
}

main().catch(console.error);
