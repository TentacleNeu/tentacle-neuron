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
  let isWorking = false;

  setInterval(async () => {
    if (isWorking) return;

    // Poll for task
    const pollResult = await api.pollTasks(neuronId);

    if (pollResult && pollResult.task) {
      const task = pollResult.task;
      console.log(`📦 Received Task [${task.id}]: ${task.prompt.substring(0, 50)}...`);

      isWorking = true;

      try {
        // Execute Task
        console.log(`🚀 Executing task with ${config.agent.type}...`);
        const result = await executeTask(config.agent, task);

        // Submit Result
        console.log(`📤 Submitting result for task ${task.id}...`);
        await api.submitResult(task.id, neuronId, result.output, result.success ? null : result.error);

        console.log('✅ Task completed & submitted.');
      } catch (err) {
        console.error('❌ Critical error executing task:', err);
        await api.submitResult(task.id, neuronId, null, err.message);
      } finally {
        isWorking = false;
        console.log('💤 Waiting for tasks...\n');
      }
    }
  }, config.settings.poll_interval || 5000);
}

main().catch(console.error);
