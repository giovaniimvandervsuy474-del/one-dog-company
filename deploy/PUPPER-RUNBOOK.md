# Pupper operations

Public spectator: http://89.208.104.230:8083/. Deployment: /opt/kitty-founder, service kitty-founder. Original Kitty service and directory are separate.

## Controls and budgets

The spectator cannot start paid work. Admin endpoints are blocked by public nginx. On the server, use authenticated POST requests to 127.0.0.1:4301/api/admin/founder-run (one cycle), founder-pause (abort and persist pause), or founder-resume (resume bounded automatic cycles). Supply X-Admin-Token from the server environment; do not put it in a URL, browser, shell history, or source code. /api/health and /api/founder are read-only.

Requesty: rolling $1/hour and $3/day, including conservative reservations for unknown charges. All Requesty requests use the shared persistent ledger. Browserbase: separate rolling 60-minute/day budget, sessions capped by timeout, uncertain starts/releases retain their maximum reservation. Requesty caps do NOT cap Browserbase, hosting, other projects or the provider account. Browser pricing is not invented; configure BROWSERBASE_USD_PER_HOUR if cost estimates are needed.

Pause is durable across restart. Stopping the service kills its child browser processes. Active browser sessions are released on graceful stop and have bounded provider-side timeouts. Interrupted tasks are marked instead of pretending they completed. Session time budget prevents runaway retries; no simultaneous research cycles.

## Product execution

Generated code runs only as an offline static HTML browser prototype, never as a server process. Preview has CSP sandbox allow-scripts, no same-origin privileges, no network, forms, frames or external scripts. Real tests exercise two distinct inputs and expected outputs, distinct-result behavior, JavaScript errors and mobile overflow. A 45-second watchdog kills the test browser. One automatic repair is allowed. Failed versions never replace the last passing artifact. APIs, auth, billing and full-stack products need deliberate future integrations.

## Fees

PUPPER_TOKEN_MINT is the supplied Pupper address. The Pump.fun bonding-curve creator is discovered on-chain after launch, or PUPPER_CREATOR_WALLET can override it. No private wallet key is needed. SOL-paired bonding-curve and PumpSwap WSOL vault balances are read-only. Only inner transfers from the derived vaults, under the official Pump programs, count as observed fee collections. Ordinary wallet deposits do not count. Creator vaults are shared across that creator's tokens; the UI labels that scope. Receipt history is observed coverage, not an all-time total. Fee-sharing / non-SOL quote configurations are not claimed as supported and must be verified before enabling that launch configuration.

## Recovery

Run deploy/pupper-backup.sh on the server before upgrades; snapshots include chronicle, workspace, config and .env and are root-only. Keep the archive private. Restore from a chosen backup with the service stopped; preserve the newest requesty-budget.json and browser-budget.json so restoring old data cannot reset spend. Do not restore an old budget ledger over a newer one. Verify /api/health, public admin 403, private file 404, a tested prototype, and pause state before resuming.

Systemd drop-in uses Restart=on-failure, 10-second backoff, start-rate limit, 40-second graceful stop, control-group kill and private file umask. No recurring backup or external publishing job is enabled by this deployment.

Implementation references: [Pump creator-fee instructions](https://github.com/pump-fun/pump-public-docs/blob/main/docs/instructions/COLLECT_CREATOR_FEE.md), [Pump bonding-curve creator vault](https://github.com/pump-fun/pump-public-docs/blob/main/docs/PUMP_CREATOR_FEE_README.md), [PumpSwap creator vault](https://github.com/pump-fun/pump-public-docs/blob/main/docs/PUMP_SWAP_CREATOR_FEE_README.md), [Browserbase CAPTCHA solver](https://www.browserbase.com/templates/basic-recaptcha), [Requesty structured output support](https://www.requesty.ai/blog/structured-outputs-across-llm-providers-the-compatibility-mess).

`founder-continue` reanalyses already saved sources, saving browser time; `development-build` retries a prototype from the saved report. Each invocation remains authenticated and bounded by the same spending ledger. Product test cases freeze the browser clock to their explicit reference date. Old failed drafts are shown as failed and cannot overwrite a tested frontend.
