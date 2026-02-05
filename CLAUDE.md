# Tentacle Neuron (矿工节点)

> 分布式 AI Agent 执行器 - 连接 Brain 并执行任务

## 技术栈

| 组件 | 技术 |
|------|------|
| 运行时 | Node.js |
| 配置 | YAML (js-yaml) |
| HTTP | node-fetch |
| Agent | Claude CLI / Aider (可扩展) |

---

## 目录结构

```
tentacle-neuron/
├── bin/
│   └── tentacle-neuron.js   # CLI 入口
├── src/
│   ├── index.js             # 主循环
│   ├── executor.js          # Agent 执行器
│   ├── api.js               # Brain 通信
│   └── config.js            # 配置加载
├── config.yaml              # 运行配置 (git ignored)
├── config.example.yaml      # 配置模板
└── README.md
```

---

## 核心流程

```
启动 → 加载配置 → 注册到 Brain → 轮询任务 → 执行 → 提交结果 → 循环
```

### 主循环逻辑 (src/index.js)

```javascript
// 并发控制
const activeTasks = new Set();
const maxConcurrent = config.settings.max_concurrent || 1;

setInterval(async () => {
  if (activeTasks.size >= maxConcurrent) return;

  const { task } = await api.pollTasks(neuronId);
  if (task) {
    activeTasks.add(task.id);
    executeTask(config.agent, task)
      .then(result => api.submitResult(...))
      .finally(() => activeTasks.delete(task.id));
  }
}, pollInterval);
```

---

## 配置说明

```yaml
# config.yaml

wallet: "your-wallet-address"      # 收款钱包 (未来 USDT)
token: "your-email@example.com"    # 必须先在网站注册的邮箱

agent:
  type: "claude"                   # claude | aider | custom
  command: "claude"                # 可执行命令
  args: "--dangerously-skip-permissions"
  timeout: 300                     # 单任务超时 (秒)
  model_tier: "medium"             # high / medium / low
  bash_path: ""                    # Windows: Git Bash 路径 (可选)

skills:                            # 声明能力，用于任务匹配
  - content_research
  - code_analysis
  - code_generation
  - translation

settings:
  server_url: "http://localhost:3000"  # Brain 地址
  poll_interval: 5000              # 轮询间隔 (ms)
  max_concurrent: 1                # 最大并发任务数
  accept_lower_tier: true          # 是否接受低级别任务
```

### 模型分级

| Tier | 可接任务 | 典型模型 |
|------|----------|----------|
| high | L1-L4 | Claude Opus |
| medium | L1-L3 | Claude Sonnet |
| low | L1-L2 | Claude Haiku |

---

## 当前任务

### P0 - 安装体验

- [ ] **安装向导优化**
  - 一键安装脚本 (curl | bash)
  - 交互式配置生成
  - 首次运行自动注册流程

- [ ] **文档完善**
  - Windows 环境配置说明
  - 常见问题排查
  - 日志解读

### P1 - 功能增强

- [ ] **本地收益统计**
  - 记录已完成任务数
  - 累计获得 ATP
  - 成功率统计

- [ ] **心跳可视化**
  - 定期打印状态
  - 连接状态指示

### P2 - 扩展性

- [ ] **多 Agent 支持**
  - Aider 执行器
  - OpenAI CLI 执行器
  - 自定义命令模板

- [ ] **自动更新检查**
  - 版本号对比
  - 提示更新

---

## 开发命令

```bash
# 安装依赖
pnpm install

# 复制配置
cp config.example.yaml config.yaml

# 编辑配置
# 设置 token 为已注册的邮箱

# 启动 Neuron
pnpm start

# 开发模式 (自动重启)
pnpm dev
```

---

## 执行器实现 (src/executor.js)

```javascript
// Claude CLI 调用
const command = `"${bashPath}" -c 'cd "${workDir}" && cat "${promptFile}" | claude --dangerously-skip-permissions -p'`;

// 超时控制
const { stdout, stderr } = await execAsync(command, {
  timeout: config.agent.timeout * 1000,
  maxBuffer: 10 * 1024 * 1024,  // 10MB
});
```

### Windows 注意事项

Claude CLI 需要通过 Git Bash 执行:

```yaml
agent:
  bash_path: "C:/Program Files/Git/bin/bash.exe"
```

或设置环境变量:
```
CLAUDE_CODE_GIT_BASH_PATH=C:/Program Files/Git/bin/bash.exe
```

---

## API 通信 (src/api.js)

### 注册

```javascript
POST /api/neurons/register
{
  wallet: "xxx",
  skills: ["code_analysis"],
  token: "user@email.com",
  modelTier: "medium",
  acceptLowerTier: true
}
```

### 轮询任务

```javascript
GET /api/tasks/poll?neuronId=xxx
// Response
{ task: { id, prompt, level, timeoutMinutes } | null }
```

### 提交结果

```javascript
POST /api/tasks/submit
{
  taskId: "xxx",
  neuronId: "xxx",
  result: "执行结果",
  error: null  // 或错误信息
}
```

---

## 日志格式

```
🐙 Tentacle Neuron Starting...
✅ Loaded config for wallet: xxx
🤖 Agent: claude
📡 Server: http://localhost:3000
📡 Connecting to Brain...
🆔 Registered Neuron ID: xxx
🧵 Concurrency Level: 1
💤 Waiting for tasks...

[Task abc12345] 📦 Received Task: 翻译这段话...
[Task abc12345] 📤 Submitting result...
[Task abc12345] ✅ Task completed & submitted.
💤 Slot freed. Active tasks: 0/1
```

---

## 注意事项

1. **token 必须是已注册用户的邮箱**
   - 先在 Brain 网站注册/登录
   - 将登录邮箱填入 config.yaml

2. **Brain API 变更时**
   - 查看根目录 CLAUDE.md 的 API 契约
   - 相应更新 src/api.js

3. **执行环境隔离**
   - MVP 阶段无沙箱
   - 后续考虑 Docker 隔离
