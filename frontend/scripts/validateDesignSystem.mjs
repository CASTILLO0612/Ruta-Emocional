import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(root, 'src');
const colorSource = path.join(sourceRoot, 'theme', 'colors.ts');
const morphIconBoundary = new Set([
  path.join(sourceRoot, 'components', 'common', 'AppMorphIcon.tsx'),
  path.join(sourceRoot, 'components', 'common', 'AppMorphIcon.types.ts'),
  path.join(sourceRoot, 'components', 'common', 'AppMorphIcon.web.tsx'),
]);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(ts|tsx)$/.test(entry.name) ? [target] : [];
  }));
  return nested.flat();
}

for (const file of await sourceFiles(sourceRoot)) {
  const contents = await readFile(file, 'utf8');
  const relativeFile = path.relative(root, file);

  assert.equal(
    /@expo\/vector-icons|MaterialIcons/.test(contents),
    false,
    `Use lucide-react-native for product icons: ${relativeFile}`
  );
  assert.equal(
    /fontWeight\s*:/.test(contents),
    false,
    `Use a named FontFamily token instead of fontWeight: ${relativeFile}`
  );

  if (!morphIconBoundary.has(file)) {
    assert.equal(
      /from\s+['"]morphicons(?:\/[^'"]+)?['"]/.test(contents),
      false,
      `Use the platform-safe AppMorphIcon boundary: ${relativeFile}`
    );
  }

  if (file !== colorSource) {
    assert.equal(
      /#[\da-f]{3,8}\b|rgba?\s*\(/i.test(contents),
      false,
      `Use a centralized color token: ${relativeFile}`
    );
  }
}

process.stdout.write('Design system checks passed.\n');
