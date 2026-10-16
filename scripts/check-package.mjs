import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this check through npm run test:package');

for (const entry of ['./dist/regions/region5.js', './dist/constants.js']) {
  execFileSync(process.execPath, ['--input-type=module', '--eval', `import '${entry}';`], {
    stdio: 'inherit',
  });
}

const directory = mkdtempSync(join(tmpdir(), 'iapws-package-consumer-'));
try {
  const packOutput = execFileSync(process.execPath, [
    npmCli, 'pack', '--json', '--ignore-scripts', '--pack-destination', directory,
  ], { encoding: 'utf8' });
  const [packageInfo] = JSON.parse(packOutput);
  const consumer = join(directory, 'consumer');
  mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  execFileSync(process.execPath, [
    npmCli, 'install', join(directory, packageInfo.filename), '--prefix', consumer,
    '--ignore-scripts', '--offline', '--no-audit', '--no-fund', '--package-lock=false',
  ], { encoding: 'utf8' });

  const packageDirectory = join(consumer, 'node_modules', packageInfo.name);
  const manifest = JSON.parse(readFileSync(join(packageDirectory, 'package.json'), 'utf8'));
  const publishedFiles = new Set(packageInfo.files.map((file) => file.path));
  for (const [subpath, conditions] of Object.entries(manifest.exports)) {
    const targets = typeof conditions === 'string' ? [['default', conditions]] : Object.entries(conditions);
    for (const [condition, target] of targets) {
      const file = posix.normalize(target);
      if (!publishedFiles.has(file)) {
        throw new Error(`Published export ${subpath} (${condition}) points to missing file: ${file}`);
      }
    }
  }

  const danglingReferences = [];
  for (const file of publishedFiles) {
    if (!/(?:\.js|\.d\.ts)$/.test(file)) continue;

    const match = readFileSync(join(packageDirectory, file), 'utf8').match(/^\/\/# sourceMappingURL=(.+)$/m);
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

  for (const fixture of ['package-consumer.mjs', 'package-consumer.mts']) {
    copyFileSync(new URL(`./fixtures/${fixture}`, import.meta.url), join(consumer, fixture));
  }
  execFileSync(process.execPath, [join(consumer, 'package-consumer.mjs')], { stdio: 'inherit' });
  execFileSync(process.execPath, [
    fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url)),
    '--strict', '--module', 'NodeNext', '--target', 'ES2022', '--noEmit', '--skipLibCheck', 'false',
    join(consumer, 'package-consumer.mts'),
  ], { cwd: consumer, stdio: 'inherit' });
} finally {
  rmSync(directory, { recursive: true, force: true });
}
