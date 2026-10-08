const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} es obligatorio.`);
  return value;
};

const integer = (name, fallback, minimum, maximum) => {
  const source = process.env[name]?.trim();
  const value = source ? Number(source) : fallback;
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} debe ser un entero entre ${minimum} y ${maximum}.`);
  }
  return value;
};

const baseUrl = new URL(required('MENTA_OLLAMA_BASE_URL'));
if (!['http:', 'https:'].includes(baseUrl.protocol)) {
  throw new Error('MENTA_OLLAMA_BASE_URL debe usar HTTP o HTTPS.');
}
const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);
if (!localHosts.has(baseUrl.hostname) && process.env.MENTA_STREAM_SMOKE_ALLOW_REMOTE !== 'true') {
  throw new Error('El smoke de MENTA sólo admite Ollama local salvo autorización explícita.');
}

const model = required('MENTA_OLLAMA_MODEL');
const timeoutMs = integer('MENTA_STREAM_SMOKE_TIMEOUT_MS', 60_000, 1_000, 180_000);
const maximumFirstDeltaMs = integer('MENTA_STREAM_SMOKE_MAXIMUM_FIRST_DELTA_MS', 30_000, 100, timeoutMs);
const maximumTotalMs = integer('MENTA_STREAM_SMOKE_MAXIMUM_TOTAL_MS', 60_000, 1_000, 300_000);
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), timeoutMs);
const startedAt = performance.now();
let firstDeltaAt = null;
let deltaCount = 0;
let generatedCharacters = 0;

try {
  const response = await fetch(new URL('/api/chat', baseUrl), {
    method: 'POST',
    headers: { Accept: 'application/x-ndjson', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Responde en español con una frase breve.' },
        { role: 'user', content: 'Confirma que estás disponible.' },
      ],
      stream: true,
      think: false,
      keep_alive: '10m',
      options: { temperature: 0.1, num_predict: 32 },
    }),
    signal: controller.signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`Ollama respondió con HTTP ${response.status}.`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';
  const consume = (line) => {
    if (!line.trim()) return;
    const payload = JSON.parse(line);
    const delta = payload?.message?.content;
    if (typeof delta !== 'string' || !delta) return;
    firstDeltaAt ??= performance.now();
    deltaCount += 1;
    generatedCharacters += delta.length;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffered += decoder.decode(value, { stream: !done });
      const lines = buffered.split(/\r?\n/);
      buffered = lines.pop() ?? '';
      lines.forEach(consume);
      if (done) break;
    }
    if (buffered.trim()) consume(buffered);
  } finally {
    reader.releaseLock();
  }

  const completedAt = performance.now();
  const firstDeltaMs = firstDeltaAt === null ? null : Math.round(firstDeltaAt - startedAt);
  const totalMs = Math.round(completedAt - startedAt);
  const result = {
    nativeStream: deltaCount > 1,
    deltaCount,
    generatedCharacters,
    firstDeltaMs,
    totalMs,
    thresholds: { maximumFirstDeltaMs, maximumTotalMs },
  };
  console.log(JSON.stringify(result, null, 2));
  if (deltaCount < 2 || generatedCharacters === 0) {
    throw new Error('Ollama no entregó una respuesta incremental válida.');
  }
  if (firstDeltaMs === null || firstDeltaMs > maximumFirstDeltaMs) {
    throw new Error('El primer fragmento de MENTA superó el umbral permitido.');
  }
  if (totalMs > maximumTotalMs) {
    throw new Error('La respuesta de MENTA superó el tiempo total permitido.');
  }
} finally {
  clearTimeout(timeout);
}
