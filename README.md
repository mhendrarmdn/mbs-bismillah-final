# MBS Decision & NPV Engine — v0.3

A local-first decision workspace for the 2026 MBS E-Case Competition.

## What works now
- Environment-aware game setup (no hard-coded Simulation 1 state)
- Current-state input
- Eight-decision workspace
- Exact structural formulas verified against the supplied Simulation 1 HAR:
  - NPV
  - Economic Equity
  - Equipment nonlinear fee
  - Equipment book-value roll-forward
  - Next production capacity
  - Replacement cost
  - Observed dividend equity-floor cap
- Capacity, raw-material, dividend, procurement-threshold and final-round warnings
- Local HAR import for:
  - environment
  - operation history
  - financial statement
  - economy/inflation data
  - ranking
  - competitor sales data
- Workspace export/import with JSON
- Simulation 1 sample dataset
- Empirical demand calibration from HAR round history (ridge model; clearly labelled calibrated)
- Transparent one-round P&L forecast
- Verified progressive marginal tax engine for Low / Moderate / High environments
- Rolling labor/material/admin cost calibration from the most recent completed round and inflation index
- Conservative / Base / Aggressive scenario comparison
- Final-round candidate search using the v0.3 state-transition engine
- Rolling multi-round optimizer from the active round through the terminal round
- Competitor-aware demand model using relative price, quality, image, macro conditions, prior unmet demand, and prior market share
- Product-quality, product-image, and conversion-factor response models
- Automatic state transitions for cash, debt/overdraft, raw materials, FGI, equipment BV, capacity, replacement cost and equity
- Deferred unmet-demand feature (50% carryover) in the empirical demand model
- Verified single-shift management-expense and miscellaneous-expense formulas
- One-click application of scenario packages back to the Decision Lab

## Intentionally NOT claimed yet
The app does not yet pretend to know the exact demand-response curve or the full forecast P&L. Expected demand and projected ending equity remain editable in v0.1. These will become automated only after calibration and validation.

## Run
### Easiest
Open `MBS_Decision_Engine_MVP.html` directly in Chrome/Edge.

### Modular development version
Serve this folder with any static server and open `index.html`.

Example:
`python -m http.server 8080`

## Competition workflow
1. Start a new game.
2. Enter or import the competition environment and Round-0 state.
3. Fill candidate decisions.
4. Check capacity, raw-material, procurement-threshold, dividend, equipment and structural-NPV effects.
5. After each TopBoss round, import a new HAR or update the state manually.
6. Export the workspace as a backup.

## Model-status discipline
The app separates three classes of logic:
- **Verified**: formulas reproduced from the actual HAR / simulator glossary.
- **Calibrated**: empirical relationships fitted from the current game's historical rounds.
- **Unknown / forecast**: never silently treated as exact.

## Validation
See `MODEL_VALIDATION.md`. The accounting/operations transition has been backtested against Simulation 1 R2-R8 and reproduces ending cash/equity/PBT within very small rounding differences.

## Next build target
v0.4: live-round backtest/audit mode, scenario uncertainty bands, stronger raw-material price forecasting, and automatic strategy explanation (“why this decision beats the alternatives”).