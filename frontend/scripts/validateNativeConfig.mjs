import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const appJson = JSON.parse(await readFile(path.join(root, 'app.json'), 'utf8'));
const easJson = JSON.parse(await readFile(path.join(root, 'eas.json'), 'utf8'));

assert.equal(packageJson.dependencies.expo, '~57.0.19');
assert.equal(packageJson.dependencies['expo-dev-client'], '~57.0.18');
assert.equal(packageJson.dependencies['expo-font'], '~57.0.3');
assert.equal(packageJson.dependencies['expo-location'], '~57.0.15');
assert.equal(packageJson.dependencies['expo-secure-store'], '~57.0.3');
assert.ok(Array.isArray(appJson.expo.plugins));
assert.equal(JSON.stringify(appJson).includes('PLACEHOLDER_GOOGLE_MAPS_API_KEY'), false);
for (const profile of ['development', 'preview', 'production']) {
  assert.equal(easJson.build[profile].environment, profile);
}

for (const forbiddenName of [
  'EXPO_PUBLIC_GEMINI_API_KEY',
  'EXPO_PUBLIC_DATABASE_URL',
  'EXPO_PUBLIC_JWT_SECRET',
  'EXPO_PUBLIC_PASSWORD_PEPPER',
]) {
  assert.equal(
    Boolean(process.env[forbiddenName]),
    false,
    `${forbiddenName} must never be injected into a client build`
  );
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(ts|tsx)$/.test(entry.name) ? [target] : [];
  }));
  return nested.flat();
}

const pictograph = /\p{Extended_Pictographic}/u;
for (const file of await sourceFiles(path.join(root, 'src'))) {
  const contents = await readFile(file, 'utf8');
  assert.equal(pictograph.test(contents), false, `Use the icon library instead of emoji: ${file}`);
}

process.stdout.write('Native production configuration checks passed.\n');
