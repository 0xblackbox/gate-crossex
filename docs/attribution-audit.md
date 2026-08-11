# Attribution and Referral Audit

Audit date: 2026-08-11  
Scope: current production source, installers, update path, user-facing links, generated frontend/backend bundles, and direct dependencies.

## Conclusion

The current tree contains no production request that attributes an account or order to the original repository author. Gate authenticated REST requests use only `Accept`, optional `Content-Type`, `KEY`, `Timestamp`, and `SIGN`. The removed `X-Gate-Channel-Id` header is covered by a regression test.

## Findings and remediation

| Severity | Finding | Remediation |
| --- | --- | --- |
| High | The README linked to Gate CrossEx with `ref=QUANTGUY`. | Removed the referral parameter and retained a plain Gate CrossEx URL. |
| High | Bootstrap, installer, update checker, support, and source-code links defaulted to the upstream author's repository. Following the fork's instructions could therefore reinstall or update from upstream. | Changed every operational default to `0xblackbox/gate-crossex`. |
| Medium | The macOS LaunchAgent identifier used the original author's namespace. | Changed it to `com.0xblackbox.gate-crossex` in install, uninstall, and tests. |
| Informational | Copyright notices still name the original author and contributors. | Retained to preserve license attribution. They are static text and cause no network traffic. |
| Informational | The bundled `lightweight-charts` dependency constructs a TradingView attribution URL containing `utm_*` fields. | Retained as third-party library attribution. It does not contain the original author's identifier or a Gate referral value. |

## Network review

- Gate authenticated REST: official Gate base URL by default; no broker, affiliate, referral, campaign, or channel field.
- Gate public REST and other market-data providers: JSON content-negotiation headers only.
- Gate private WebSocket: API authentication payload only; no author channel identifier.
- Boros/Pendle: public strategy and market-data endpoints with `Accept: application/json`.
- Frontend: same-origin calls to the local backend; no analytics or remote crash-reporting SDK.
- GitHub: source bootstrap and release update checks now target the fork.

## Verification

- `scripts/no-attribution.test.mjs` scans production, installer, update, and user-facing source for the removed Gate channel header, referral query parameters, and the upstream operational repository.
- Gate client tests verify `X-Gate-Channel-Id` is absent and passed 16/16.
- Bootstrap/update tests, release-installer tests, lint, typecheck, and production build passed.
- `npm audit` reported zero known vulnerabilities at audit time.

## Residual trust boundaries

- `GCT_GATE_REST_URL`, `GCT_GATE_PUBLIC_WS_URL`, and `GCT_GATE_PRIVATE_WS_URL` can override Gate endpoints for development and testing. A hostile launch environment could redirect credentials, so production launch configuration must keep these variables unset.
- Older Git commits retain historical strings. The current branch and generated production bundle are the audited deliverables.
- The fork currently needs its own GitHub Release artifacts before the release-based installer can install `latest`; the source bootstrap path already targets the fork.
