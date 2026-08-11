# Security and Trading-Integrity Audit — Round 3

Audit date: 2026-08-11  
Scope: production order sizing and pricing, strategy repairs, exchange fees, transfers, credentials,
logs, runtime dependencies, install scripts, and outbound destinations.

## Executive conclusion

No maintainer commission, affiliate recipient, fee diversion, withdrawal destination, analytics
SDK, or credential exfiltration path was found in the current production tree. Manual orders keep
the validated user price and quantity. Strategy orders change quantities only for documented hedge
ratios, exchange lot-size rounding, target remainders, or explicit risk repair.

One trading-integrity issue was found: after a maker-taker strategy reached its target with a
sub-minimum-notional residual, the engine could submit an additional non-reduce-only market order
and then a larger reduce-only market order. This briefly increased exposure and paid two more sets
of trading costs. It was logged, but it did not require explicit user consent.

The repair is now disabled by default. Such a residual pauses the strategy for manual review unless
the strategy input explicitly sets `allowExposureIncreasingDustRepair: true`. The opt-in path remains
covered for operators who deliberately prefer automatic dust cleanup.

## Findings

| Severity | Finding | Result |
| --- | --- | --- |
| Medium | Terminal dust cleanup could manufacture extra market volume with a 10% minimum-notional buffer, briefly increase exposure, and incur two additional executions. | Default changed to pause without placing either order. A schema-level explicit opt-in and both default/opt-in regression tests were added. |
| Informational | Manual order requests pass validated price, quantity, side, type, time-in-force, position side, and reduce-only flag to the Gate request without a spread, multiplier, fee recipient, or hidden quantity uplift. | No change required. |
| Informational | Strategy sizing performs expected ADR/share conversion, equal-notional conversion, lot-size rounding, target remainder handling, and hedge repair. Maker limit prices remain inside the configured economic threshold. | No hidden beneficiary or unexplained markup found. |
| Informational | Fee fields are read from Gate/Pendle responses and used for display or return estimation. | No code changes exchange fees or redirects any portion to a third party. |
| Informational | Fund movement is restricted to enumerated Gate internal account types. The request has no address, network, memo, recipient, withdrawal, or arbitrary endpoint field. | The backend also validates route rules, precision, minimum amount, source balance, live-mode state, and an explicit transfer-intent header. |
| Informational | Credentials are stored in the OS keychain or an owner-only `0600` environment file written atomically. The database stores metadata only. | Fastify redacts authorization, cookie, Gate signing headers, API key, API secret, key, secret, and signature fields. Credential failures log labels instead of upstream secret-bearing payloads. |
| Informational | The production dependency tree contains no analytics, crash-reporting, or telemetry SDK. | The only production lifecycle script is `better-sqlite3`'s native build. The root install policy permits that script and blocks `esbuild`/`fsevents`; package resolutions use `registry.npmjs.org`. |

## Authenticated boundary

Authenticated Gate REST calls are limited to CrossEx account, position, order, leverage, fee,
internal-transfer, account-book, and spot-balance operations. No withdrawal or wallet-address route
exists in the gateway interface. The authenticated REST and private WebSocket destinations default
to Gate's official hosts; non-default endpoints require `GCT_ALLOW_UNSAFE_GATE_ENDPOINTS=1`.

Public market-data calls reach the documented Gate, Binance, OKX, Bybit, Kraken, Hyperliquid,
Deribit, and Pendle/Boros public endpoints. They do not receive Gate credentials. Frontend external
URLs are visible source/support/market links rather than background analytics.

## Verification

- Focused strategy/runtime regression: 67/67 passed.
- Full unit suite: 352/352 passed.
- Chromium end-to-end suite: 11/11 passed.
- Bootstrap/update checks: 9 passed, 1 Windows-only check skipped on macOS.
- Release checks: 10 passed, 3 Windows-only checks skipped on macOS.
- Lint, typecheck, and production build passed.
- `npm audit`: 434 dependencies checked; 0 known vulnerabilities at every severity.

## Remaining operational risk

This review establishes code behavior, not strategy profitability. Exchange trading fees, funding,
slippage, maker non-fill, partial fills, latency, liquidation, venue outages, and basis movement can
still turn an apparent spread negative. The safest default now stops at an uneconomical terminal
residual rather than creating extra turnover automatically.
