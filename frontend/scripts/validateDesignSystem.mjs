import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(root, 'src');
const colorSource = path.join(sourceRoot, 'theme', 'colors.ts');
const brandAssetBoundaries = new Set([
  path.join(sourceRoot, 'components', 'common', 'BrandLogo.tsx'),
]);
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
  assert.equal(
    /Dimensions\.get\s*\(/.test(contents),
    false,
    `Use useWindowDimensions for rotation and web resizing: ${relativeFile}`
  );
  assert.equal(
    /style\s*=\s*\{\{/.test(contents),
    false,
    `Move static inline styles into the design system: ${relativeFile}`
  );
  assert.equal(
    /\bAlert\.alert\s*\(|window\.(?:alert|confirm|prompt)\s*\(/.test(contents),
    false,
    `Use the branded alert provider instead of native browser or OS dialogs: ${relativeFile}`
  );
  assert.equal(
    /accessibilityRole=["']radio["'][\s\S]{0,300}accessibilityState\s*=\s*\{\{\s*selected(?:\s*[:,}])/.test(contents),
    false,
    `Expose checked, not selected, for radio controls: ${relativeFile}`
  );

  for (const match of contents.matchAll(/accessibilityRole=["'](radio|checkbox|tab)["']/g)) {
    const role = match[1];
    const followingProps = contents.slice(match.index, match.index + 500);
    const requiredAriaState = role === 'tab' ? 'aria-selected=' : 'aria-checked=';
    assert.equal(
      followingProps.includes(requiredAriaState),
      true,
      `Expose ${requiredAriaState.slice(0, -1)} for ${role} controls on web: ${relativeFile}`
    );
  }

  if (!morphIconBoundary.has(file)) {
    assert.equal(
      /from\s+['"]morphicons(?:\/[^'"]+)?['"]/.test(contents),
      false,
      `Use the platform-safe AppMorphIcon boundary: ${relativeFile}`
    );
  }

  if (!brandAssetBoundaries.has(file)) {
    assert.equal(
      /ruta-emocional-(?:isotype|logo-(?:positive|negative))\.png/.test(contents),
      false,
      `Consume official brand assets through BrandLogo: ${relativeFile}`
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
