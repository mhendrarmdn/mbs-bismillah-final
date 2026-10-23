# MBS Engine Validation Notes

## Scope
Validation uses the supplied **MBS Simulation 1 Group 1** HAR and the Markowitz company's actual R2-R8 decisions/outcomes.

## State-transition validation

The app now computes the current forecast engine's historical error directly in the **Backtest & Confidence** tab instead of hard-coding a small error claim.

Why this changed:
- Several accounting identities and expense formulas are verified exactly or nearly exactly.
- Future unit labor cost is only described as being affected by the price index; the full published formula is not available.
- Demand, conversion, quality, image, and future raw-material prices remain calibrated forecasts.
- Therefore the full forecast transition can have materially larger error than the accounting identities alone.

R1 is treated separately because the opening inventory initialization is special. The live backtest starts at R2.


## Mechanics reproduced from the HAR/glossary
- Equipment depreciation: 2.5% of beginning book value per round.
- Equipment book value roll-forward.
- Equipment nonlinear operating fee: investment^2 / 10,000,000.
- Production-capacity decay and inflation-adjusted capacity purchase.
- Replacement cost using next capacity and next price index.
- Economic Equity and NPV.
- Dividend equity-floor cap observed in Mode 3.
- Single-shift labor/overtime formula.
- Progressive income tax brackets.
- Ordering-cost step schedule.
- Management and miscellaneous expense formulas.
- Finished-goods ending unit value = 3 x current price index in the observed Model-2 rounds.
- Finished-goods holding cost = ending FGI value / 6.
- Raw-material holding cost = 5% x beginning RM inventory value.
- Inventory COGS adjustment = beginning FGI value - ending FGI value.
- Current procurement cash price = previous round's disclosed next raw-material price.
- Current procurement enters ending raw-material inventory through moving-average valuation.
- Previous overdraft rolls into normal debt in the following round.

## Calibrated (not exact published formulas)
- Potential demand response.
- Product quality response to R&D / maintenance / competitors.
- Product image response to marketing / competitors.
- Material conversion response to R&D / maintenance.
- Future raw-material price when the simulator has not yet disclosed it.
- Future competitor behavior.

## Simulation-1 response-model diagnostics

The app displays live training-sample diagnostics for the currently loaded HAR:
- competitor-aware potential demand model
- product-quality response model
- product-image response model
- conversion-factor response model

These are descriptive in-sample diagnostics, not guarantees for the competition environment.

## Uncertainty layer
v0.4 adds a stress test around the selected rolling path. It perturbs demand and conversion using the observed model residual dispersion and reports:
- NPV P10 / median / P90
- probability of any overdraft
- probability that terminal NPV remains positive

This is a model-risk sensitivity band, not a formal confidence interval.


## Walk-forward / live-safe calibration

v0.5 prevents same-game future rounds from being used to fit the live competitor-aware models.

- At round t, current-game response models are fitted only through round t-1.
- If the current game has too few observations, the app falls back to a Simulation-1 prior model for demand and conversion.
- Once live demand is observed, the prior demand level is scaled toward the current game's realized market level.
- Backtest diagnostics use the same round-by-round information cutoff.

This reduces retrospective look-ahead bias, but the Simulation-1 prior can still be structurally wrong if the competition environment differs materially.


## Post-round reconciliation

v0.7 adds a deliberately short-memory correction layer for live competition use:

1. Lock a forecast snapshot immediately before submitting a round.
2. Import the HAR after TopBoss calculates the round.
3. Compare predicted vs actual demand, conversion, sales, net profit, ending cash and ending equity.
4. Update bounded demand-scale and conversion-bias corrections.
5. If procurement cash price can be isolated cleanly, update a bounded raw-material-price scale.
6. Re-run the rolling optimizer for the next round.

The correction is shrunk once a current-game response model has enough observations, so one noisy round does not permanently dominate the forecast.


## Competitor scenario branching

v0.8 no longer requires a single frozen-rival assumption for every future round. The rolling optimizer can be stress-tested under:
- Hold latest observed competitor position
- Price war: average rival price -3%
- Stronger rivals: higher average quality and image
- Adverse mix: lower rival price plus stronger quality/image and slightly higher rival volume

These are user-selected stress scenarios, not forecasts of competitor intent.

## Learning-impact comparison

The app can temporarily neutralize the short-memory live correction factors, run the rolling optimizer, then restore learned corrections and run it again. It reports:
- terminal NPV before learning
- terminal NPV after learning
- delta NPV
- whether the first recommended decision package changed

This helps distinguish a material post-round learning update from a cosmetic one.


## Sensitivity / robustness interpretation

v0.9 evaluates first-decision robustness in two ways:

### Local heatmaps
- Price x Production
- Marketing x R&D

Each heatmap cell fixes the current-round decision variant and then re-optimizes the remaining rounds with a compact beam search. Therefore the cell value is a projected terminal NPV with an adapted continuation path, not simply current-round profit.

The app reports how many cells remain within 1% and 3% of the local maximum. A broad set of near-optimal cells suggests the recommendation is less sensitive to small parameter errors; a single isolated peak suggests higher model-overfit risk.

### Scenario ensemble
Candidate first decisions are generated under:
- Hold latest rivals
- Price war
- Stronger rival quality/image
- Adverse mix

Each candidate is then evaluated across all four scenarios. The current robust score is:

Robust score = mean projected NPV - 0.35 x standard deviation of projected NPV.

This is a decision-robustness heuristic, not a probability-weighted expected value. Scenario probabilities are intentionally not implied unless the team explicitly supplies them.


## Weighted rival-scenario beliefs

v0.10 lets the team assign non-negative weights to the four rival scenarios:
- Hold latest
- Price war
- Stronger quality/image
- Adverse mix

Weights are normalized to 100%. They are user beliefs, not probabilities inferred by the simulator.

For each candidate first decision:
- weighted mean projected NPV is calculated across the four rival scenarios
- weighted NPV standard deviation is calculated
- worst and best scenario NPVs are still displayed
- robust score = weighted mean NPV - 0.35 x weighted NPV standard deviation

If all weights are set to zero, the engine falls back to equal 25% weights.

## Competition Dashboard confidence label

The dashboard's HIGH / MEDIUM / LOW label is a heuristic summary based on:
- local Price x Production heatmap breadth
- stress-test overdraft probability
- stress-test P10 NPV
- worst rival-scenario NPV

It is a decision-support indicator, not a statistical confidence level or guarantee of competition performance.


## Evaluation cache

v0.11 caches repeated fixed-first-decision continuation evaluations during heatmap and scenario-ensemble work. The cache key includes the active round, total horizon, rival scenario, key company-state values, live calibration factors, beam width, and the eight decision values. The cache is cleared when user inputs change and at the start of major analysis runs.

This is a performance optimization only; it does not change model formulas or decision ranking.

## Rival-weight presets

Preset buttons only populate user-defined scenario weights:
- Balanced: 25 / 25 / 25 / 25
- Base-heavy: 50 / 20 / 15 / 15
- Defensive: 15 / 20 / 20 / 45
- Price-war: 15 / 50 / 15 / 20

They are convenience defaults, not inferred probabilities.

## Printable sheets

The printable submission sheet contains the eight recommended decisions, selected robustness metrics, scenario weights, and active submission warnings. The post-round brief shows the latest forecast-vs-actual reconciliation and updated calibration factors. These are team workflow artifacts, not official TopBoss reports.


## v0.13 live-safe cutoff validation

A critical hardening issue was found and fixed: the competitor-aware model accepted a `maxRound` cutoff but its loop still used all historical rounds. In Competition Mode this could leak future same-game observations into the model.

After the fix:
- R1 uses 0 same-game response rows.
- R2 may use only R1.
- R3 may use only R1-R2.
- R4 may use only R1-R3.
- The six-feature competitor-aware demand regression requires 4 usable rows and therefore is not activated within a four-round preliminary horizon.
- R1-R4 demand instead uses a Simulation-1 absolute-demand prior, current-game short-memory calibration, and a sign-constrained competitor adjustment.

### Early-round competitor adjustment

The unconstrained 8-round competitor regression had unstable causal directions due to the tiny sample. It is retained as a diagnostic only.

For live early rounds:
- a higher own price relative to rivals can only reduce the competitor adjustment;
- a stronger own quality gap can only improve the competitor adjustment;
- a stronger own image gap can only improve the competitor adjustment;
- the multiplicative adjustment is bounded to avoid extreme extrapolation.

Synthetic scenario tests confirm the intended direction:
- Price War < Hold demand
- Stronger Rivals < Hold demand
- Adverse Mix < Hold demand

### Early-round uncertainty

A walk-forward R1-R4 replay using only information available before each round and the historical submitted decisions produced demand MAE on the order of ~83k units in this single historical game. This is not a universal error estimate, but it demonstrates substantial early-round model uncertainty.

Accordingly, when no current-game demand model is active:
- stress testing uses a larger demand sigma based on the Simulation-1 prior residual with an additional conservatism multiplier;
- R1 confidence is capped low;
- R2 confidence is capped medium;
- missing post-round reconciliation also caps confidence;
- the Competition Dashboard explicitly warns that demand is prior-assisted.
