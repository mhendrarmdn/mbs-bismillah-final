# MBS Decision Engine — Hardening Report v0.13

## Scope

This report records end-to-end hardening performed on the current single-file application before competition use.

## Static integrity checks

Latest tested application commit before this report: `71a8eb094984896efde25888cadfbdf5f29828db`.

- Main JavaScript syntax: PASS
- Embedded engine JavaScript syntax: PASS
- HAR worker JavaScript syntax: PASS
- Duplicate HTML IDs: none
- Navigation targets without matching sections: none
- Event-handler IDs without matching elements: none
- Known single-dollar selector + `.forEach` misuse: none
- Sidebar navigation overflow fix: active; bottom information box no longer overlays menu entries

## Runtime smoke tests

The application was initialized in a mocked browser DOM and the main computation paths were actually executed rather than only syntax-checked.

### Initialization

PASS.

Two runtime bugs were found and fixed during hardening:

1. `v02DemandFit()` referenced an undefined `maxRound`.
2. Scenario buttons used `$().forEach` instead of `$$().forEach`. A previous replacement attempt had also been neutralized by JavaScript replacement-string `$$` escaping; the persisted source is now correct.

### Rolling Optimizer

PASS for a 4-round competition horizon.

Smoke-test result on the bundled Simulation-1 prior state:
- projected path length: 4 rounds
- optimizer completed without runtime exception
- no abnormal debt on the selected sample path

The projected NPV from this smoke test is a model output and is not a historical performance claim.

### Competition Dashboard preparation

PASS.

The complete pipeline executed:
1. rolling optimizer
2. rival-scenario ensemble
3. robust continuation path
4. uncertainty stress test
5. Price x Production sensitivity heatmap
6. cockpit rendering

### Confidence guard

PASS.

Competition confidence is forced down when a usable current competitor snapshot is missing. The bundled sample does not contain the full competitor panel, so the smoke test correctly returns LOW confidence instead of a misleading HIGH confidence.

## Historical forecast-engine backtest

The live backtest currently uses completed Simulation-1 rounds R2-R8.

Current maximum absolute errors:

| Metric | Max absolute error |
|---|---:|
| Ending cash | about $25,986 |
| Ending owner's equity | about $25,984 |
| Profit before tax | about $49,885 |

The largest observed PBT error is concentrated in R6 and was isolated primarily to unit labor-cost forecasting, not to the core accounting identities.

## Labor-cost hardening

v0.12 adds:

- bounded live `laborScale` calibration
- predicted labor unit cost stored in the locked submission snapshot
- actual labor unit cost reconciled from the post-round financial statement
- labor-scale update for the next-round forecast
- labor-cost uncertainty in Monte Carlo / stress testing
- labor-scale visibility in the learning loop and Competition Dashboard

The full official future labor-cost formula is still not available, so labor remains a calibrated forecast variable rather than a verified TopBoss formula.

## Decision-grade prerequisites

Before treating a recommendation as decision-grade during competition:

1. Switch to **Competition / Live-safe** mode.
2. Import the latest current-game HAR where possible.
3. Confirm current company state and environment.
4. Confirm competitor snapshot is available; otherwise dashboard confidence will be capped.
5. Run **Prepare Competition View**.
6. Review hard-block warnings, P10/P50/P90, overdraft probability, rival worst case, and sensitivity breadth.
7. Lock the forecast snapshot immediately before submission.
8. After the round, import the new HAR and let the learning loop reconcile forecast vs actual.

## Remaining calibrated / uncertain mechanics

These are not claimed to be exact published TopBoss equations:

- potential-demand response
- product-quality response
- product-image response
- material conversion response
- future raw-material cash price
- future unit labor cost
- future competitor behavior

They are managed through current-game learning, scenario branching, robustness ranking, sensitivity analysis, and stress testing.

## Opening-round caveat

R1 has special opening inventory initialization behavior. Historical state-transition validation begins at R2 for this reason.



## Additional critical findings fixed in v0.13

### Critical look-ahead leak
`v03BehaviorModels(maxRound)` previously ignored `maxRound` inside its round loop. This meant Competition Mode could fit response models using future historical rows when replaying a full HAR.

**Status: FIXED.**

Regression check:
- R1 same-game rows = 0
- no R1 same-game demand model is active
- current-game future rounds are not used for live fitting

### Early competitor prior
The original early competitor regression was too small to be treated causally and learned unstable coefficient directions. It is no longer used directly for early-round demand.

The live fallback now combines:
1. Simulation-1 absolute-demand prior
2. bounded short-memory current-game demand correction
3. directionally constrained competitor adjustment using relative price, quality gap and image gap

### Competitor prior vs current-game snapshot
Bundled Simulation-1 competitor aggregates are available for Practice mode and prior calibration.

In **Competition Mode**, bundled competitor data does **not** satisfy the current-game readiness check. A current HAR with competitor rows must be imported before competitor readiness is considered present.

## Current regression matrix

- HTML duplicate IDs: none
- Navigation targets without sections: none
- Main JS syntax: PASS
- Engine JS syntax: PASS
- HAR worker syntax: PASS
- Known single-dollar `$().forEach` misuse: none
- Browser initialization smoke test: PASS
- Four-round Rolling Optimizer smoke test: PASS
- Scenario Ensemble runtime test: PASS
- Price x Production heatmap runtime test: PASS
- Marketing x R&D heatmap runtime test: PASS
- Prepare Competition View full pipeline: PASS
- Competition without current HAR: NOT READY / LOW by design
- Competition with HAR-like competitor data: full 4-round pipeline PASS
- Price War / Stronger / Adverse demand direction test: PASS

## Current historical forecast limitations

The accounting identities are materially tighter than the forecasting layer.

R2-R8 structural backtest currently shows maximum absolute error of approximately:
- Ending cash: $25,986
- Ending equity: $25,984
- Profit before tax: $49,885

The largest PBT error was isolated primarily to future labor-unit-cost forecasting. v0.13 therefore includes live labor-scale learning and labor-cost uncertainty.

A stricter R1-R4 walk-forward test using only pre-round information can show materially larger demand/profit errors because future competitor actions are genuinely unknown. In one historical replay, demand MAE was ~83k units. This is why R1-R2 confidence is intentionally capped and stress/ensemble outputs should be prioritized over point forecasts.

## Current readiness assessment

### Software/runtime readiness
**PASS for competition rehearsal and controlled live use.**

### Live model readiness
**Conditional.** Before submission, import the current-game HAR and review the Competition Dashboard. If competitor rows are missing, the app will warn and cap confidence.

### What is verified vs calibrated
Verified structural/accounting mechanics remain separated from calibrated demand, competitor behavior, raw-material-price and labor-cost forecasts.

### Required rehearsal
Before the real event, run at least one complete R1-R4 rehearsal:
1. Competition Mode
2. import latest HAR
3. Prepare Competition View
4. lock the chosen snapshot
5. advance one round
6. import new HAR
7. reconcile forecast vs actual
8. re-run optimizer
9. repeat through R4

Do not treat a single projected NPV point estimate as a guarantee.
