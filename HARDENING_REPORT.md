# MBS Decision Engine — Hardening Report v0.12

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

## Current readiness assessment

### Software/runtime readiness
**PASS for competition rehearsal.**

The major menu, optimizer, stress-test, sensitivity, competition-cockpit, snapshot/reconciliation, and export paths initialize and run without the runtime failures found during hardening.

### Model certainty
**Mixed by design.**

Verified accounting/structural formulas are separated from calibrated forecasting relationships. Recommendations should therefore be treated as decision support under uncertainty, not as a guaranteed reconstruction of hidden TopBoss demand/competitor functions.

### Recommended next action
Run one complete rehearsal using the real historical HAR workflow:
- start at R1
- lock a decision snapshot
- advance using historical results one round at a time
- import/reconcile each round
- record the recommendation changes and robustness metrics through R4

This should be done before the actual competition.
