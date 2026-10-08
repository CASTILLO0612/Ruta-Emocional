import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readEnvironment(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) return { absolutePath, values: new Map() };

  const values = new Map();
  for (const rawLine of fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2
      && ((value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values.set(name, value);
  }
  return { absolutePath, values };
}

function present(values, name) {
  const value = values.get(name)?.trim();
  return Boolean(value && !/placeholder|replace[_-]?me|example/iu.test(value));
}

function report(name, failures, notices = []) {
  const state = failures.length === 0 ? 'READY' : 'PENDING';
  process.stdout.write(`${name}: ${state}\n`);
  for (const failure of failures) process.stdout.write(`  - ${failure}\n`);
  for (const notice of notices) process.stdout.write(`  - ${notice}\n`);
  return state === 'READY';
}

const backend = readEnvironment('backend/.env');
const frontend = readEnvironment('frontend/.env.local');

const resendFailures = [];
if (backend.values.get('PASSWORD_RESET_PROVIDER')?.toUpperCase() !== 'RESEND') {
  resendFailures.push('PASSWORD_RESET_PROVIDER no está configurado como RESEND.');
}
if (!present(backend.values, 'PASSWORD_RESET_RESEND_API_KEY')) {
  resendFailures.push('Falta una API key de Resend válida en el entorno local.');
}
if (!present(backend.values, 'PASSWORD_RESET_SENDER')) {
  resendFailures.push('Falta un remitente verificado de Resend.');
}
if (!present(backend.values, 'PASSWORD_RESET_URL')) {
  resendFailures.push('Falta la URL de recuperación de contraseña.');
}

const pushFailures = [];
if (backend.values.get('PUSH_NOTIFICATIONS_ENABLED')?.toLowerCase() !== 'true') {
  pushFailures.push('PUSH_NOTIFICATIONS_ENABLED no está activado.');
}
const projectId = frontend.values.get('EXPO_PUBLIC_EAS_PROJECT_ID')?.trim() ?? '';
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(projectId)) {
  pushFailures.push('Falta un UUID válido en EXPO_PUBLIC_EAS_PROJECT_ID.');
}
const googleServicesSetting = frontend.values.get('GOOGLE_SERVICES_FILE')?.trim() ?? '';
const googleServicesPath = googleServicesSetting
  ? path.resolve(path.dirname(frontend.absolutePath), googleServicesSetting)
  : path.join(root, 'frontend/google-services.json');
if (!googleServicesSetting || !fs.existsSync(googleServicesPath)) {
  pushFailures.push('Falta GOOGLE_SERVICES_FILE o frontend/google-services.json.');
} else {
  try {
    const googleServices = JSON.parse(fs.readFileSync(googleServicesPath, 'utf8'));
    const packages = Array.isArray(googleServices.client)
      ? googleServices.client.map(
        (client) => client?.client_info?.android_client_info?.package_name
      )
      : [];
    if (!packages.includes('com.rutaemocional.app')) {
      pushFailures.push('google-services.json no corresponde a com.rutaemocional.app.');
    }
  } catch {
    pushFailures.push('google-services.json no contiene JSON válido.');
  }
}

const mediaFailures = [];
if (backend.values.get('MEDIA_STORAGE_PROVIDER')?.toUpperCase() !== 'S3') {
  mediaFailures.push('MEDIA_STORAGE_PROVIDER no está configurado como S3.');
}
if (!present(backend.values, 'MEDIA_S3_REGION')) {
  mediaFailures.push('Falta MEDIA_S3_REGION.');
}
if (!present(backend.values, 'MEDIA_S3_BUCKET')) {
  mediaFailures.push('Falta MEDIA_S3_BUCKET.');
}
if (!fs.existsSync(path.join(root, 'infra/aws/cloudformation/media-security.yaml'))) {
  mediaFailures.push('Falta la plantilla de CloudFormation para S3 y GuardDuty.');
}

const results = [
  report('Resend', resendFailures),
  report('Expo + FCM', pushFailures),
  report('S3 + GuardDuty', mediaFailures, [
    'El despliegue y el estado de GuardDuty deben verificarse en la cuenta AWS.',
  ]),
];

if (results.every(Boolean)) {
  process.stdout.write('Preflight local completo. Continúa con las pruebas reales de proveedores.\n');
  process.exitCode = 0;
} else {
  process.stdout.write('Preflight incompleto. No se imprimió ningún secreto.\n');
  process.exitCode = 1;
}
