# MBS Engine Validation Notes

## Scope
Validation uses the supplied **MBS Simulation 1 Group 1** HAR and the Markowitz company's actual R2-R8 decisions/outcomes.

## State-transition backtest
Using actual potential demand and actual conversion factor to isolate the accounting/operations engine:

| Metric | Maximum absolute error vs simulator, R2-R8 |
|---|---:|
| Ending cash | about $302 |
| Ending owner's equity | about $373 |
| Profit before tax | about $631 |
| Total cash operating expense | below $1 per round in the tested R2-R8 cases |

The small residual differences are consistent with hidden rounding/truncation of material consumption and tax bases.

R1 is intentionally excluded from this validation because the opening finished-goods cost basis has special initialization behavior that does not match the regular R2+ inventory roll-forward.

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
Using eight observed Markowitz rounds:
- Competitor-aware potential demand model: R2 ~0.839; MAE ~34.4k units.
- Product-quality response model: R2 ~0.900.
- Product-image response model: R2 ~0.816.
- Conversion-factor response model: R2 ~0.644; MAE ~0.0059.

These diagnostics are training-sample fit statistics, not guarantees for the competition environment.
