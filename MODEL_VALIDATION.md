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
