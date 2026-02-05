import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 模块级缓存（单例模式）- 避免重复加载配置
let cachedConfig = null;

export function loadConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPaths = [
    path.join(process.cwd(), 'config.yaml'),
    path.join(process.cwd(), 'config.yml'),
    path.join(__dirname, '..', 'config.yaml'),
    path.join(__dirname, '..', 'config.yml'),
  ];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = yaml.load(content);
      config._source = configPath;
      
      // Defaults
      if (!config.settings) config.settings = {};
      if (!config.settings.max_concurrent) config.settings.max_concurrent = 1;
      if (!config.settings.poll_interval) config.settings.poll_interval = 5000;
      if (!config.settings.poll_backoff_max_ms) config.settings.poll_backoff_max_ms = 30000;
      if (!config.settings.stats_interval_ms) config.settings.stats_interval_ms = 60000;
      if (config.settings.allow_dangerous === undefined) config.settings.allow_dangerous = false;
      if (!config.settings.register_backoff_max_ms) config.settings.register_backoff_max_ms = 30000;
      if (config.settings.submit_meta === undefined) config.settings.submit_meta = false;

      cachedConfig = config;
      return cachedConfig;
    }
  }

  console.error('❌ No config.yaml found. Please create one from config.example.yaml');
  process.exit(1);
}
