# Tentacle Neuron Task Protocol (MVP)

This document defines the minimal task schema and submission format supported by `tentacle-neuron`.

## Task (Brain -> Neuron)

```json
{
  "id": "task-uuid",
  "prompt": "Do something...",
  "level": "L2",
  "timeoutMinutes": 15,
  "workDir": "D:/projects/my-repo"
}
```

### Fields

- `id` (string, required): Task identifier
- `prompt` (string, required): Instruction passed to the agent
- `level` (string, optional): L1 | L2 | L3 | L4
- `timeoutMinutes` (number, optional): Overrides agent timeout
- `workDir` (string, optional): Working directory for execution
- `projectPath` (string, optional): Alias for `workDir`
- `repoPath` (string, optional): Alias for `workDir`

### Work Directory Resolution

Neuron resolves the working directory in this order:
1. `task.workDir`
2. `task.projectPath`
3. `task.repoPath`
4. `settings.default_work_dir`
5. `process.cwd()`

## Poll Response

```json
{ "task": { ... } }
```

If no task is available:

```json
{ "task": null }
```

## Result Submission (Neuron -> Brain)

```json
{
  "taskId": "task-uuid",
  "neuronId": "neuron-uuid",
  "result": "plain text output",
  "error": null
}
```

### Structured Result (Optional)

If `settings.submit_meta = true`, Neuron submits structured metadata:

```json
{
  "taskId": "task-uuid",
  "neuronId": "neuron-uuid",
  "result": {
    "success": true,
    "output": "plain text output",
    "error": null,
    "durationMs": 1234,
    "workDir": "D:/projects/my-repo",
    "level": "L2"
  },
  "error": null,
  "meta": {
    "success": true,
    "output": "plain text output",
    "error": null,
    "durationMs": 1234,
    "workDir": "D:/projects/my-repo",
    "level": "L2"
  }
}
```

Brain should treat `result` as the primary display field and may use `meta` if present.