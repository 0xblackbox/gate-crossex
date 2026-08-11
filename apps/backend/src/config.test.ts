import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('Gate endpoint configuration', () => {
  it('uses only the official Gate endpoints by default', () => {
    const config = loadConfig({});
    expect(config.gateRestBaseUrl).toBe('https://api.gateio.ws/api/v4');
    expect(config.gatePublicWebSocketUrl).toBe('wss://api.gateio.ws/ws/crossex/public');
    expect(config.gatePrivateWebSocketUrl).toBe('wss://api.gateio.ws/ws/crossex');
  });

  it('rejects a silent authenticated endpoint redirect', () => {
    expect(() => loadConfig({ GCT_GATE_REST_URL: 'https://example.invalid/api/v4' }))
      .toThrow(/GCT_ALLOW_UNSAFE_GATE_ENDPOINTS=1/);
    expect(() => loadConfig({ GCT_GATE_PRIVATE_WS_URL: 'wss://example.invalid/ws' }))
      .toThrow(/GCT_ALLOW_UNSAFE_GATE_ENDPOINTS=1/);
  });

  it('requires an explicit unsafe flag for loopback test endpoints', () => {
    const config = loadConfig({
      GCT_ALLOW_UNSAFE_GATE_ENDPOINTS: '1',
      GCT_GATE_REST_URL: 'http://127.0.0.1:9001/api/v4',
      GCT_GATE_PUBLIC_WS_URL: 'ws://127.0.0.1:9002/public',
      GCT_GATE_PRIVATE_WS_URL: 'ws://127.0.0.1:9002/private',
    });
    expect(config.gateRestBaseUrl).toBe('http://127.0.0.1:9001/api/v4');
    expect(config.gatePrivateWebSocketUrl).toBe('ws://127.0.0.1:9002/private');
  });

  it('rejects endpoint URLs containing credentials or query parameters', () => {
    expect(() => loadConfig({
      GCT_ALLOW_UNSAFE_GATE_ENDPOINTS: '1',
      GCT_GATE_REST_URL: 'https://user:pass@example.invalid/api/v4',
    })).toThrow(/not a valid Gate endpoint/);
    expect(() => loadConfig({
      GCT_ALLOW_UNSAFE_GATE_ENDPOINTS: '1',
      GCT_GATE_PRIVATE_WS_URL: 'wss://example.invalid/ws?source=hidden',
    })).toThrow(/not a valid Gate endpoint/);
  });
});
