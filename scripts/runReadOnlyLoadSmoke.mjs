import { performance } from 'node:perf_hooks';

function readInteger(name, fallback, minimum, maximum) {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function percentile(sortedValues, percentage) {
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * percentage) - 1),
  );
  return sortedValues[index];
}

const baseUrl = process.env.LOAD_BASE_URL?.trim();
if (!baseUrl) throw new Error('LOAD_BASE_URL is required');

const route = process.env.LOAD_ROUTE?.trim() || '/api/v1/health/ready';
if (!route.startsWith('/api/v1/')) {
  throw new Error('LOAD_ROUTE must be a read-only route under /api/v1/');
}

const target = new URL(route, baseUrl);
const requestCount = readInteger('LOAD_REQUESTS', 100, 1, 10_000);
const concurrency = readInteger('LOAD_CONCURRENCY', 10, 1, 100);
const timeoutMs = readInteger('LOAD_TIMEOUT_MS', 5_000, 100, 60_000);
const maximumP95Ms = readInteger('LOAD_MAXIMUM_P95_MS', 1_000, 1, 60_000);
const allowedFailures = readInteger('LOAD_ALLOWED_FAILURES', 0, 0, requestCount);
const accessToken = process.env.LOAD_ACCESS_TOKEN?.trim();
const durations = [];
const statusCounts = new Map();
const failures = [];
let nextRequest = 0;

async function runWorker() {
  while (nextRequest < requestCount) {
    const requestIndex = nextRequest;
    nextRequest += 1;
    const startedAt = performance.now();
    try {
      const response = await fetch(target, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      await response.arrayBuffer();
      durations.push(performance.now() - startedAt);
      statusCounts.set(response.status, (statusCounts.get(response.status) ?? 0) + 1);
      if (!response.ok) failures.push({ requestIndex, status: response.status });
    } catch (error) {
      durations.push(performance.now() - startedAt);
      failures.push({
        requestIndex,
        error: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }
}

const startedAt = performance.now();
await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
const totalDurationMs = performance.now() - startedAt;
const sortedDurations = durations.toSorted((left, right) => left - right);
const result = {
  target: target.toString(),
  requests: requestCount,
  concurrency,
  failures: failures.length,
  statusCounts: Object.fromEntries([...statusCounts.entries()].sort(([left], [right]) => left - right)),
  latencyMs: {
    minimum: Number(sortedDurations[0].toFixed(2)),
    p50: Number(percentile(sortedDurations, 0.5).toFixed(2)),
    p95: Number(percentile(sortedDurations, 0.95).toFixed(2)),
    p99: Number(percentile(sortedDurations, 0.99).toFixed(2)),
    maximum: Number(sortedDurations.at(-1).toFixed(2)),
  },
  throughputPerSecond: Number((requestCount / (totalDurationMs / 1_000)).toFixed(2)),
  thresholds: {
    maximumP95Ms,
    allowedFailures,
  },
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

if (failures.length > allowedFailures || result.latencyMs.p95 > maximumP95Ms) {
  process.exitCode = 1;
}
