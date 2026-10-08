import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const appJson = JSON.parse(await readFile(path.join(root, 'app.json'), 'utf8'));
const easJson = JSON.parse(await readFile(path.join(root, 'eas.json'), 'utf8'));
const navigationPlugin = await readFile(
  path.join(root, 'plugins', 'withGoogleNavigationSdk.js'),
  'utf8'
);
const navigationLegalNotices = await readFile(
  path.join(root, 'assets', 'legal', 'google-navigation-legal.html'),
  'utf8'
);

async function pngDimensions(relativePath) {
  const bytes = await readFile(path.join(root, relativePath));
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG', `${relativePath} must be a PNG image`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

assert.equal(packageJson.dependencies.expo, '~57.0.19');
assert.equal(packageJson.dependencies['expo-dev-client'], '~57.0.19');
assert.equal(packageJson.dependencies['expo-font'], '~57.0.3');
assert.equal(packageJson.dependencies['expo-location'], '~57.0.20');
assert.equal(packageJson.dependencies['expo-secure-store'], '~57.0.4');
assert.equal(packageJson.dependencies['@expo/dom-webview'], '57.0.1');
assert.equal(packageJson.dependencies['@googlemaps/react-native-navigation-sdk'], '0.16.3');
assert.ok(packageJson.dependencies['@livekit/react-native']);
assert.ok(packageJson.dependencies['@livekit/react-native-expo-plugin']);
assert.ok(packageJson.dependencies['@livekit/react-native-webrtc']);
assert.ok(packageJson.dependencies['livekit-client']);
assert.equal('react-native-webview' in packageJson.dependencies, false);
assert.equal('react-native-maps' in packageJson.dependencies, false);
assert.ok(Array.isArray(appJson.expo.plugins));
assert.ok(appJson.expo.plugins.includes('./plugins/withGoogleNavigationSdk'));
const liveKitPlugin = appJson.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === '@livekit/react-native-expo-plugin');
assert.ok(liveKitPlugin, 'LiveKit native setup must be configured for development builds');
assert.equal(liveKitPlugin[1].android.audioType, 'communication');
const webRtcPlugin = appJson.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === '@config-plugins/react-native-webrtc');
assert.ok(webRtcPlugin, 'WebRTC native permissions must be configured for development builds');
assert.ok(webRtcPlugin[1].cameraPermission.includes('videollamada'));
assert.ok(webRtcPlugin[1].microphonePermission.includes('llamada'));
assert.ok(navigationPlugin.includes("'android.kotlinVersion': '2.3.0'"));
assert.ok(navigationPlugin.includes("com.android.tools.build:gradle:8.13.2"));
assert.ok(navigationPlugin.includes("org.jetbrains.kotlin:kotlin-gradle-plugin:2.3.0"));
assert.ok(navigationPlugin.includes("desugar_jdk_libs_nio:2.1.5"));
assert.ok(navigationPlugin.includes("navigation:navigation:7.6.1"));
assert.ok(navigationPlugin.includes("module: 'play-services-maps'"));
assert.ok(navigationLegalNotices.includes('Google Navigation SDK para Android 7.8.0'));
assert.ok(navigationLegalNotices.includes('https://www.google.com/help/terms_maps.html'));
assert.ok(navigationLegalNotices.includes('https://www.google.com/help/legalnotices_maps.html'));
assert.ok(navigationLegalNotices.includes('Licencias de código abierto'));
assert.ok(navigationLegalNotices.includes('This software may contain portions of the following libraries'));
assert.equal(JSON.stringify(appJson).includes('PLACEHOLDER_GOOGLE_MAPS_API_KEY'), false);
assert.equal(appJson.expo.icon, './assets/icon.png');
assert.equal(appJson.expo.android.adaptiveIcon.foregroundImage, './assets/android-icon-foreground.png');
assert.equal('monochromeImage' in appJson.expo.android.adaptiveIcon, false);
assert.equal(appJson.expo.android.adaptiveIcon.backgroundColor, '#253A82');
assert.equal('backgroundImage' in appJson.expo.android.adaptiveIcon, false);
assert.equal(appJson.expo.web.favicon, './assets/favicon.png');
assert.equal(appJson.expo.web.lang, 'es');
assert.equal(appJson.expo.web.themeColor, '#253A82');

const splashPlugin = appJson.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen');
assert.ok(splashPlugin, 'expo-splash-screen plugin must be configured');
assert.equal(splashPlugin[1].image, './assets/splash-icon.png');
assert.equal(splashPlugin[1].imageWidth, 200);
assert.equal(splashPlugin[1].resizeMode, 'contain');
assert.equal(splashPlugin[1].backgroundColor, '#253A82');

for (const [asset, expectedWidth, expectedHeight] of [
  ['assets/icon.png', 1024, 1024],
  ['assets/android-icon-foreground.png', 1024, 1024],
  ['assets/splash-icon.png', 1024, 1024],
  ['assets/favicon.png', 96, 96],
  ['assets/brand/ruta-emocional-isotype.png', 576, 500],
  ['assets/brand/ruta-emocional-logo-positive.png', 912, 300],
  ['assets/brand/ruta-emocional-logo-negative.png', 1212, 380],
]) {
  const dimensions = await pngDimensions(asset);
  assert.equal(dimensions.width, expectedWidth, `${asset} has an unexpected width`);
  assert.equal(dimensions.height, expectedHeight, `${asset} has an unexpected height`);
}
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
