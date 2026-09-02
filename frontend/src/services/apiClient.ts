import { fetch as expoFetch } from 'expo/fetch';
import { getLegacyApiBaseUrl, getVersionOneApiBaseUrl } from '../config/runtimeConfig';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ProblemFieldError {
  readonly field?: string;
  readonly code: string;
  readonly message: string;
}

export interface ProblemDetails {
  readonly type?: string;
  readonly title?: string;
  readonly status?: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly code?: string;
  readonly requestId?: string;
  readonly errors?: readonly ProblemFieldError[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly fieldErrors: readonly ProblemFieldError[];

  constructor(options: {
    readonly status: number;
    readonly code: string;
    readonly message: string;
    readonly requestId?: string;
    readonly fieldErrors?: readonly ProblemFieldError[];
    readonly cause?: unknown;
  }) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.fieldErrors = options.fieldErrors ?? [];
  }
}

export interface ApiRequestOptions {
  readonly authenticated?: boolean;
  readonly retryUnauthorized?: boolean;
  readonly signal?: AbortSignal;
  readonly idempotencyKey?: string;
}

type RefreshAccessToken = () => Promise<string | null>;

interface PreparedRequestBody {
  readonly value?: BodyInit;
  readonly contentType?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

type FetchTransport = (input: string, init?: RequestInit) => Promise<Response>;

const expoBinaryTransport: FetchTransport = (input, init) => expoFetch(input, init);

let accessToken: string | null = null;
let refreshAccessToken: RefreshAccessToken | null = null;

export function setAuthToken(token: string | null): void {
  accessToken = token;
}

export function getAuthToken(): string | null {
  return accessToken;
}

export function configureAuthRefresh(handler: RefreshAccessToken): void {
  refreshAccessToken = handler;
}

function validateEndpoint(endpoint: string): void {
  if (!endpoint.startsWith('/') || endpoint.includes('://')) {
    throw new ApiError({
      status: 0,
      code: 'INVALID_API_ENDPOINT',
      message: 'La ruta solicitada no es válida.',
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readResponsePayload(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const responseText = await response.text();
  if (!responseText) return undefined;

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    if (response.ok) {
      throw new ApiError({
        status: response.status,
        code: 'INVALID_API_RESPONSE',
        message: 'El servidor devolvió una respuesta que no pudimos interpretar.',
      });
    }
    return undefined;
  }
}

function toApiError(response: Response, payload: unknown): ApiError {
  const problem = isRecord(payload) ? payload as ProblemDetails : undefined;
  return new ApiError({
    status: response.status,
    code: typeof problem?.code === 'string' ? problem.code : `HTTP_${response.status}`,
    message: typeof problem?.detail === 'string'
      ? problem.detail
      : 'No pudimos completar la operación solicitada.',
    requestId: typeof problem?.requestId === 'string' ? problem.requestId : undefined,
    fieldErrors: Array.isArray(problem?.errors) ? problem.errors : undefined,
  });
}

async function executeRequest<T>(
  baseUrl: string,
  endpoint: string,
  method: HttpMethod,
  body: PreparedRequestBody,
  options: ApiRequestOptions,
  transport: FetchTransport = globalThis.fetch
): Promise<T> {
  validateEndpoint(endpoint);

  const authenticated = options.authenticated !== false;
  const headers: Record<string, string> = { Accept: 'application/json', ...body.headers };
  if (body.contentType) headers['Content-Type'] = body.contentType;
  if (authenticated && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  let response: Response;
  try {
    response = await transport(`${baseUrl}${endpoint}`, {
      method,
      headers,
      body: body.value,
      signal: options.signal,
    });
  } catch (cause) {
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'No pudimos conectarnos con Ruta Emocional. Revisa tu conexión.',
      cause,
    });
  }

  if (
    response.status === 401
    && authenticated
    && options.retryUnauthorized !== false
    && refreshAccessToken
  ) {
    const nextAccessToken = await refreshAccessToken();
    if (nextAccessToken) {
      return executeRequest<T>(baseUrl, endpoint, method, body, {
        ...options,
        retryUnauthorized: false,
      }, transport);
    }
  }

  const payload = await readResponsePayload(response);
  if (!response.ok) throw toApiError(response, payload);
  return payload as T;
}

export function apiRequest<T>(
  endpoint: string,
  method: HttpMethod = 'GET',
  body?: unknown,
  options: ApiRequestOptions = {}
): Promise<T> {
  return executeRequest<T>(
    getLegacyApiBaseUrl(),
    endpoint,
    method,
    body === undefined
      ? {}
      : { value: JSON.stringify(body), contentType: 'application/json' },
    options
  );
}

export function apiV1Request<T>(
  endpoint: string,
  method: HttpMethod = 'GET',
  body?: unknown,
  options: ApiRequestOptions = {}
): Promise<T> {
  return executeRequest<T>(
    getVersionOneApiBaseUrl(),
    endpoint,
    method,
    body === undefined
      ? {}
      : { value: JSON.stringify(body), contentType: 'application/json' },
    options
  );
}

export function apiV1BinaryRequest<T>(
  endpoint: string,
  method: 'POST' | 'PUT',
  body: Blob,
  options: ApiRequestOptions & {
    readonly contentType: string;
    readonly fileName: string;
  }
): Promise<T> {
  return executeRequest<T>(
    getVersionOneApiBaseUrl(),
    endpoint,
    method,
    {
      value: body,
      contentType: options.contentType,
      headers: { 'X-Evidence-File-Name': encodeURIComponent(options.fileName) },
    },
    options,
    expoBinaryTransport
  );
}
