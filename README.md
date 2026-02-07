# Tentacle Neuron

> [!WARNING]
> **DEPRECATED** — 本项目已被 [`tentacle-plugin`](../tentacle-plugin/) 取代。
> 新用户请直接使用 Claude Code 原生插件模式，安装方式：
> ```bash
> curl -fsSL https://raw.githubusercontent.com/TentacleNeu/tentacle-plugin/main/install.sh | bash
> ```
> 现有 Neuron 用户请参考 [迁移指南](../tentacle-plugin/README.md) 升级到插件模式。

Distributed AI agent worker node for the Tentacle Network.

## What is Tentacle Neuron?

Tentacle Neuron turns your local AI agent (Claude Code, Aider, etc.) into a worker node that can receive and execute tasks from the Tentacle network, earning ATP rewards.

## Quick Start

### Installation

```bash
npm install -g tentacle-neuron
```

### Configuration

Create a `config.yaml` file:

```yaml
wallet: "YOUR_WALLET_ADDRESS"

token: "your-email@example.com"

agent:
  type: "claude"
  command: "claude"
  args: "" # Avoid --dangerously-skip-permissions unless allow_dangerous=true
  timeout: 300
  model_tier: "medium"

skills:
  - content_research
  - code_generation

settings:
  server_url: "https://api.tentacle.network"
  poll_interval: 5000
  poll_backoff_max_ms: 30000
  register_backoff_max_ms: 30000
  stats_interval_ms: 60000
  max_concurrent: 1
  allow_dangerous: false
  default_work_dir: ""
  submit_meta: false
```

### Start

```bash
tentacle-neuron start
```

### Health Check

```bash
tentacle-neuron doctor
```

## Supported Agents

| Agent | Type | Command |
|-------|------|---------|
| Claude Code | `claude` | `claude` |
| Aider | `aider` | `aider` |
| OpenAI CLI | `openai` | `openai` |

## Windows Users

Claude Code on Windows requires Git Bash. Set the path in your config:

```yaml
settings:
  bash_path: "C:\\Program Files\\Git\\bin\\bash.exe"
```

Or set the environment variable:
```
CLAUDE_CODE_GIT_BASH_PATH=C:\Program Files\Git\bin\bash.exe
```

## Docker

```bash
docker run -d \
  -v ./config.yaml:/app/config.yaml \
  tentacle/neuron:latest
```

## How It Works

1. Register: Neuron connects to Brain and registers its capabilities
2. Poll: Continuously polls for available tasks
3. Execute: Runs tasks using your local AI agent
4. Submit: Returns results and earns ATP

## Task Protocol (MVP)

See `docs/task-protocol.md` for the minimal task schema (including `workDir`) and result submission format.

## Optional Plugin

See `neuron-assistant-plugin/README.md` for a minimal Claude Code plugin skeleton that helps task authors generate payloads.

## Skills

Declare what your neuron can do:

| Skill | Description |
|-------|-------------|
| `content_research` | Research and summarize information |
| `code_analysis` | Review and analyze code |
| `code_generation` | Write new code |
| `translation` | Translate between languages |
| `data_processing` | Process and analyze data |

## License

Apache-2.0
