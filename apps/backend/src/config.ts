import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const GATE_REST_URL = 'https://api.gateio.ws/api/v4';
const GATE_PUBLIC_WEBSOCKET_URL = 'wss://api.gateio.ws/ws/crossex/public';
const GATE_PRIVATE_WEBSOCKET_URL = 'wss://api.gateio.ws/ws/crossex';

export interface BackendConfig {
  host: string;
  port: number;
  dataDir: string;
  databasePath: string;
  credentialEnvPath: string;
  migrationsDir: string;
  frontendDistPath: string;
  allowedOrigin: string;
  allowedOrigins: ReadonlySet<string>;
  allowedHosts: ReadonlySet<string>;
  gateRestBaseUrl: string;
  gatePublicWebSocketUrl: string;
  gatePrivateWebSocketUrl: string;
}

function parsePort(value: string, name: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }
  return port;
}

function gateEndpoint(
  environment: NodeJS.ProcessEnv,
  name: 'GCT_GATE_REST_URL' | 'GCT_GATE_PUBLIC_WS_URL' | 'GCT_GATE_PRIVATE_WS_URL',
  fallback: string,
  protocols: ReadonlySet<string>,
): string {
  const value = environment[name] ?? fallback;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL`);
  }
  if (!protocols.has(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${name} is not a valid Gate endpoint URL`);
  }
  if (value !== fallback && environment.GCT_ALLOW_UNSAFE_GATE_ENDPOINTS !== '1') {
    throw new Error(`${name} override requires GCT_ALLOW_UNSAFE_GATE_ENDPOINTS=1`);
  }
  return value;
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): BackendConfig {
  const host = environment.GCT_HOST ?? '127.0.0.1';
  const port = parsePort(environment.PORT ?? environment.GCT_PORT ?? '17840', 'GCT_PORT');
  const frontendPort = parsePort(environment.GCT_FRONTEND_PORT ?? '5173', 'GCT_FRONTEND_PORT');
  const dataDir = resolve(environment.GCT_DATA_DIR ?? join(projectRoot, '.local-data'));
  const configuredHosts = (environment.GCT_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  const allowedOrigin = environment.GCT_FRONTEND_ORIGIN ?? `http://127.0.0.1:${frontendPort}`;
  // Browsers send the loopback host the user actually typed; localhost, 127.0.0.1, and [::1]
  // variants of the local UI and backend are all the same trust domain.
  const loopbackOrigins = [frontendPort, port].flatMap((loopbackPort) => [
    `http://127.0.0.1:${loopbackPort}`,
    `http://localhost:${loopbackPort}`,
    `http://[::1]:${loopbackPort}`,
  ]);
  return {
    host,
    port,
    dataDir,
    databasePath: join(dataDir, 'gate-crossex.sqlite'),
    credentialEnvPath: resolve(environment.GCT_CREDENTIAL_ENV_PATH ?? join(projectRoot, '.env')),
    migrationsDir: resolve(environment.GCT_MIGRATIONS_DIR ?? join(projectRoot, 'migrations')),
    frontendDistPath: resolve(environment.GCT_FRONTEND_DIST_DIR ?? join(projectRoot, 'apps/frontend/dist')),
    allowedOrigin,
    allowedOrigins: new Set([allowedOrigin, ...loopbackOrigins]),
    allowedHosts: new Set(['127.0.0.1', 'localhost', '::1', ...configuredHosts]),
    gateRestBaseUrl: gateEndpoint(environment, 'GCT_GATE_REST_URL', GATE_REST_URL, new Set(['https:', 'http:'])),
    gatePublicWebSocketUrl: gateEndpoint(environment, 'GCT_GATE_PUBLIC_WS_URL', GATE_PUBLIC_WEBSOCKET_URL, new Set(['wss:', 'ws:'])),
    gatePrivateWebSocketUrl: gateEndpoint(environment, 'GCT_GATE_PRIVATE_WS_URL', GATE_PRIVATE_WEBSOCKET_URL, new Set(['wss:', 'ws:'])),
  };
}
