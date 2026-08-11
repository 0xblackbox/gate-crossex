# Security and Trading-Integrity Audit — Round 4

Audit date: 2026-08-12  
Scope: strategy profitability accounting, fee and funding treatment, order idempotency and restart
behavior, browser and local-API boundaries, SQL construction, outbound destinations, CI permissions,
dependency lifecycle scripts, and release/source installers.

## Executive conclusion

No new maintainer commission, affiliate attribution, fee recipient, withdrawal destination,
credential-export path, hidden order multiplier, or unexplained order destination was found.

One financially relevant reporting issue was found. Historical strategies displayed Gate's gross
fill-level realized PnL as generic `Realized PnL`, hard-coded the unit as USDT, and did not subtract
the separately reported trading fees. A strategy could therefore look more profitable than its
recorded trades actually were. The runtime now exposes gross realized PnL, trading fees, and net
trade PnL separately. The history table displays the fee-adjusted value as an estimated USD amount
and visibly states that funding is excluded.

One browser hardening gap was also found. The script-free credential form had a strict CSP, but the
main trading console did not. A restrictive application-wide CSP now permits same-origin scripts,
styles/assets, forms, and local WebSockets while blocking inline/evaluated scripts, objects, frames,
and framing by other pages.

## Findings

| Severity | Finding | Result |
| --- | --- | --- |
| Medium | Strategy history summed `execution_fills.realized_pnl` but ignored `execution_fills.fee`, then labeled the gross result as generic realized PnL and always showed USDT. | Added exact Decimal aggregation for `realizedPnl`, `tradingFees`, and `netRealizedPnl = realizedPnl - tradingFees`. The UI now shows `Net trade PnL`, `USD est.`, the fee total, and `funding excluded`. |
| Low | Helmet explicitly disabled CSP for the main SPA. | Added an application-wide CSP with strict `script-src 'self'`, `script-src-attr 'none'`, `object-src 'none'`, `frame-src 'none'`, `frame-ancestors 'none'`, same-origin forms/assets, and same-origin/local WebSocket connectivity. Inline styles remain permitted because the React UI uses computed style attributes. |
| Informational | Gate reports trade fee and realized PnL as separate fill fields. | The local ledger already persisted both exact decimal strings; no database migration or estimate from order notional was needed. |
| Informational | Funding settlements are account/venue/coin events and are not reliably attributable to one local strategy when strategies overlap or positions predate a strategy. | Funding is not folded into `netRealizedPnl`; the UI states this limitation instead of presenting the value as complete strategy profit. |
| Informational | Manual order submission creates a random client order ID and persists `PENDING_SUBMIT` before the remote call. Ambiguous results remain pending and are reconciled by client ID; definitive 4xx rejections alone become failures. | No duplicate-order or unknown-submit regression found. Concurrent refresh/cancel calls are coalesced, strategy actors serialize ticks, and open strategy orders block the next clip. |
| Informational | Every backend restart begins trading-locked. Persisted running strategies remain detached until explicit live activation first quiesces/reconciles remote orders. | No restart path that silently resumes ordering was found. |
| Informational | Request parameters reach prepared SQL statements or fixed internal SQL fragments. The migration directive parser restricts identifiers and definitions before the only identifier interpolation. | No request-controlled SQL identifier or clause was found. |
| Informational | Public market requests switch among fixed provider hosts and encode validated symbols. Authenticated Gate endpoints are pinned unless the explicit unsafe-endpoint development flag is set. | No browser-controlled or request-controlled SSRF host was found. |
| Informational | GitHub Actions use read-only top-level permissions, commit-pinned actions, no `pull_request_target`/`workflow_run`, and a tag-only release job with scoped `contents: write`. | No untrusted pull-request secret or release-token path was found. |
| Informational | Dependency installation is lockfile-based with strict lifecycle-script allowlisting. Only `better-sqlite3` is allowed to execute an install script; `esbuild` and `fsevents` are explicitly denied. | No analytics/telemetry dependency or unexpected allowed lifecycle script was found. |

## Profitability interpretation

`netRealizedPnl` is an execution-ledger metric, not a complete return calculation. It subtracts the
fees actually reported on strategy-linked fills from realized trade PnL. It intentionally excludes:

- funding paid or received;
- unrealized PnL on any remaining exposure;
- capital opportunity cost and cross-stablecoin conversion differences;
- liquidation, transfer, borrowing, or venue-specific account charges not attached to a fill; and
- economic slippage versus the signal price, except where that slippage is already reflected in the
  exchange-reported realized PnL.

Consequently, the terminal can now avoid the previous fee overstatement, but a positive historical
`Net trade PnL` alone does not establish that the complete strategy made money.

## Order, restart, and local boundary review

- `client_order_id` is unique in SQLite and generated independently for each accepted local order.
- A local row exists before network submission, so private fills arriving before the REST response
  can still be matched and replayed.
- Network errors, 5xx responses, and unreadable success bodies are treated as ambiguous rather than
  as permission to retry with a new identity.
- Duplicate cancels and concurrent remote refreshes share their in-flight promise.
- Each strategy actor has a serialized queue, overlapping ticks collapse into one follow-up pass,
  and an existing nonterminal strategy order prevents another clip.
- Host and Origin checks reject foreign origins and DNS-rebinding host headers. State-changing
  routes additionally require operation-specific intent headers and validated request schemas.
- React has no production `dangerouslySetInnerHTML`, `eval`, `Function`, or `document.write` sink.
  The separate credential page escapes rendered values, uses a one-time CSRF token, disables
  browser JavaScript, and overrides the general CSP with its nonce-scoped policy.

## Installation and release review

- CI actions are pinned by full commit SHA, normal jobs have `contents: read`, and only the tag
  publisher receives `contents: write`.
- Release installers validate SHA-256, archive structure, product/platform/architecture metadata,
  and the full source commit before activation; update activation is health-checked with rollback.
- Source bootstraps validate archive paths, install from the lockfile with strict script policy,
  verify the private Node runtime against Node's published checksums, and activate atomically.
- Source installation defaults to the mutable `main` ref unless `GCT_SOURCE_REF` and optionally
  `GCT_SOURCE_SHA256` are supplied. Release checksums are published with the release rather than by
  an independent signing authority. Prebuilt archives remain without Apple notarization or Windows
  Authenticode signing. These trust limits are documented and were not silently upgraded by this
  audit.

## Verification

- Focused backend regression: 98/98 passed.
- Full unit suite: 352/352 passed.
- Chromium end-to-end suite: 11/11 passed.
- Bootstrap/update checks: 9 passed, 1 Windows-only check skipped on macOS.
- Release checks: 10 passed, 3 Windows-only checks skipped on macOS.
- Lint, typecheck, and production build passed.
- `npm audit`: 434 dependencies checked; 0 known vulnerabilities at every severity.

