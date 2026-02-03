import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function loadConfig() {
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
      return config;
    }
  }

  console.error('❌ No config.yaml found. Please create one from config.example.yaml');
  process.exit(1);
}
