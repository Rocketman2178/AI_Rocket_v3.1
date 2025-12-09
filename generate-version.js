import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json to get version
const packageJsonPath = join(__dirname, 'package.json');
const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

const versionInfo = {
  version: pkg.version,
  timestamp: new Date().toISOString()
};

// Write version.json to public directory
const publicPath = join(__dirname, 'public', 'version.json');
writeFileSync(publicPath, JSON.stringify(versionInfo, null, 2));

console.log(`✅ Generated version.json: v${pkg.version}`);
