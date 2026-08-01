import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this check through npm run test:package');

const packOutput = execFileSync(process.execPath, [
  npmCli,
  'pack',
  '--dry-run',
  '--json',
  '--ignore-scripts',
], { encoding: 'utf8' });
const [packageInfo] = JSON.parse(packOutput);
const publishedFiles = new Set(packageInfo.files.map((file) => file.path));
const danglingReferences = [];

for (const file of publishedFiles) {
  if (!/(?:\.js|\.d\.ts)$/.test(file)) continue;

  const match = readFileSync(file, 'utf8').match(/^\/\/# sourceMappingURL=(.+)$/m);
  if (!match) continue;

  const reference = match[1].trim();
  if (reference.startsWith('data:')) continue;

  const target = posix.normalize(posix.join(posix.dirname(file), reference));
  if (!publishedFiles.has(target)) danglingReferences.push(`${file} -> ${target}`);
}

if (danglingReferences.length > 0) {
  throw new Error(
    `Published files contain dangling sourcemap references:\n${danglingReferences.join('\n')}`,
  );
}
