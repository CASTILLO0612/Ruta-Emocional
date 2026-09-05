import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');

const readRepositoryFile = (path) =>
  readFileSync(join(repositoryRoot, path), 'utf8');

const fail = (message) => {
  throw new Error(`Documentación de entrega inconsistente: ${message}`);
};

const assertSameSet = (actual, expected, label) => {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = [...expectedSet].filter((value) => !actualSet.has(value));
  const extra = [...actualSet].filter((value) => !expectedSet.has(value));

  if (
    actual.length !== actualSet.size ||
    missing.length > 0 ||
    extra.length > 0
  ) {
    fail(
      `${label}; faltan [${missing.join(', ')}], sobran [${extra.join(
        ', ',
      )}] o existen duplicados.`,
    );
  }
};

const prismaSchema = readRepositoryFile('backend/prisma/schema.prisma');
const modelBlocks = [
  ...prismaSchema.matchAll(/^model\s+(?<name>\w+)\s*\{(?<body>.*?)^\}/gms),
];
const modelNames = modelBlocks.map((match) => match.groups.name);
const physicalTableNames = modelBlocks.map((match) => {
  const mappedName = match.groups.body.match(/@@map\("(?<name>[^"]+)"\)/);
  return mappedName?.groups.name ?? match.groups.name;
});
const enumCount = [...prismaSchema.matchAll(/^enum\s+\w+\s*\{/gm)].length;

const normalizationDocument = readRepositoryFile(
  'docs/database/normalization-3nf.md',
);
const documentedRelations = [
  ...normalizationDocument.matchAll(/^\| `(?<name>[^`]+)` \|/gm),
].map((match) => match.groups.name);
assertSameSet(
  documentedRelations,
  physicalTableNames,
  'la matriz 3FN no cubre exactamente las relaciones Prisma',
);

const traceabilityDocument = readRepositoryFile(
  'docs/Hackathon/desarrollo/Entregable/trazabilidad-modelo-vigente.md',
);
const tracedModels = [
  ...traceabilityDocument.matchAll(/^\| `(?<name>\w+)` \|/gm),
].map((match) => match.groups.name);
assertSameSet(
  tracedModels,
  modelNames,
  'la trazabilidad conceptual no cubre exactamente los modelos Prisma',
);

const migrationDirectory = join(repositoryRoot, 'backend/prisma/migrations');
const migrationCount = readdirSync(migrationDirectory, { withFileTypes: true }).filter(
  (entry) => entry.isDirectory(),
).length;

const conceptualDocument = readRepositoryFile(
  'docs/Hackathon/desarrollo/Entregable/modelo-entidad-relacion-conceptual.md',
);
const deliveryMatrix = readRepositoryFile(
  'docs/Hackathon/desarrollo/Entregable/matriz-cumplimiento-entrega.md',
);
const declaredFacts = [
  [modelBlocks.length, 'Modelos Prisma'],
  [enumCount, 'Dominios enumerados'],
  [migrationCount, 'Migraciones versionadas'],
];

for (const [value, label] of declaredFacts) {
  const rowPattern = new RegExp(
    `\\| ${label.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')} \\| ${value} \\|`,
  );
  if (!rowPattern.test(deliveryMatrix)) {
    fail(`la matriz de entrega no declara ${label} = ${value}`);
  }
}

for (const statement of [
  '**43 tipos de entidad conceptual**',
  '**72 asociaciones semánticas**',
]) {
  if (!conceptualDocument.includes(statement)) {
    fail(`falta la declaración conceptual ${statement}`);
  }
}

const pdfPath = join(
  repositoryRoot,
  'docs/Hackathon/desarrollo/Entregable/Diagrama ER.pdf',
);
if (!existsSync(pdfPath)) {
  fail(`no existe ${relative(repositoryRoot, pdfPath)}`);
}
const pdfHeader = readFileSync(pdfPath).subarray(0, 5).toString('ascii');
if (pdfHeader !== '%PDF-') {
  fail('el entregable DER no contiene una cabecera PDF válida');
}

const trackedFiles = execFileSync('git', ['ls-files'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
})
  .split(/\r?\n/)
  .filter(Boolean)
  .map((path) => path.replaceAll('\\', '/'));
const forbiddenPrivateDocuments = trackedFiles.filter(
  (path) =>
    /^docs\/Hackathon\/DOC_PROYECTO/i.test(path) ||
    /^docs\/Hackathon\/Identidad Visual\//i.test(path),
);
if (forbiddenPrivateDocuments.length > 0) {
  fail(
    `documentos privados rastreados por Git: ${forbiddenPrivateDocuments.join(', ')}`,
  );
}

console.log(
  [
    'Documentación de entrega validada.',
    `Modelos Prisma: ${modelBlocks.length}.`,
    `Relaciones con cobertura 3FN: ${documentedRelations.length}.`,
    `Modelos con trazabilidad conceptual: ${tracedModels.length}.`,
    `Enumeraciones: ${enumCount}.`,
    `Migraciones: ${migrationCount}.`,
    'DER PDF: válido.',
    'Documentos privados rastreados: 0.',
  ].join(' '),
);
