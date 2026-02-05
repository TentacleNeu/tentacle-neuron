
import { spawn } from 'child_process';
import http from 'http';

// Mock Brain Server
const PORT = 3001;
const mockTasks = [
  { id: 'task_A', prompt: 'Task A (Slow)', timeoutMinutes: 1 },
  { id: 'task_B', prompt: 'Task B (Fast)', timeoutMinutes: 1 },
  { id: 'task_C', prompt: 'Task C (Medium)', timeoutMinutes: 1 },
];

let taskQueue = [...mockTasks];
let activeResults = [];

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 1. Register Mock
  if (req.url === '/api/neurons/register' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: 'mock-neuron-id', success: true }));
    console.log('Server: Neuron registered');
    return;
  }

  // 2. Poll Mock
  if (req.url.startsWith('/api/tasks/poll') && req.method === 'GET') {
    if (taskQueue.length > 0) {
      const task = taskQueue.shift();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ task }));
      console.log(`Server: Served task ${task.id}`);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'No tasks' }));
    }
    return;
  }

  // 3. Submit Mock
  if (req.url === '/api/tasks/submit' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      const data = JSON.parse(body);
      activeResults.push({ id: data.taskId, timestamp: Date.now() });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      console.log(`Server: Received result for ${data.taskId}`);

      if (activeResults.length === 3) {
        console.log('Server: All tasks completed. Verification done.');
        process.exit(0);
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, async () => {
  console.log(`Mock Brain running on port ${PORT}`);
  console.log('Starting Neuron with max_concurrent=3...');
  
  // Note: This expects the neuron to be configured to point to port 3001
  // We can override this via env var if the code supports it, but currently config.js loads from file.
  // For this test, we assume the user will modify config.yaml temporarily OR we rely on manual observation.
  console.log('IMPORTANT: Please temporarily set server_url: "http://localhost:3001" in config.yaml for this test to work automatically.');
  console.log('Or just run this script to host the server and point your neuron manually.');
});
