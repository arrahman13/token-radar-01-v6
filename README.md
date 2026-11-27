# Token Radar v6

[![Competition](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![Rank](https://make.fun/badge/token-radar-01/arrahman13/token-radar-01-v6/rank.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![Reward](https://make.fun/badge/token-radar-01/arrahman13/token-radar-01-v6/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A program that reads a frozen DefiLlama snapshot and hands back a ranked board of
pre-token protocols worth farming next, with a costed farm plan for each one. Entry
for the make.fun bounty
[token-radar-01](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01).

## What it answers

Which pre-token protocol is worth farming next, and what do I do about it — from the
snapshot's own figures, never from a hand-kept list of names.

## The board

198 rows: every pre-token protocol that passes the watchlist's own exclusion test —
the 40 on the house watchlist, the 20 above the $50M floor the house list leaves out
(labelled ABOVE FLOOR), and the 138 below the floor. Ranks are by implied (expected)
value: the fitted launch value times the token odds. Top rows: Polymarket International
$114.73M, Anemoy Capital $86.40M, Lofty $57.38M, USDD $44.23M, STRATO CDP $36.48M;
median implied value $4.68M; board checksum
d305b9b6c690cc3faaef1906a3b4f8d106ebe63742e78384cbfdb8b00a840dec. The other 560
protocols in the snapshot are accounted for in the dashboard's disposition
tab with the reason each one is not on the board. Nothing in the snapshot is left out.

## The value model

Huber regression (k = 1.345) of ln(mcap / TVL) on the 87 traded peers (mcap >= $5M).
Terms: size (ln TVL centred on the peers), size3 (its cube), growth_age (7-day growth,
winsorised to [-50, +50]% and scaled to units of 50 points, times ln age) and size_growth
(size times growth). The board's implied value is the expected launch value: the fitted
launch value times the token odds. Coefficients are fitted at run time from the snapshot;
nothing is hard-coded.

| Validation | Factor |
|---|---|
| Leave-one-out | x2.783 |
| Walk-forward (expanding 50/60/70%, next 20%, dated peers only) | x2.363 |
| 10-fold CV (3 repeats) | x2.795 |
| Leave-one-category-out | x2.833 |
| 80% conformal interval | x4.183 (coverage 0.82) |

Terms were kept only when they lowered BOTH blind tests by more than 0.001 and worsened
neither guard. The search ran 16 single terms, all 120 pairs and greedy forward from the
best pairs; size, size3, growth_age and size_growth is the endpoint nothing else beats.
Category offsets were tried for the value model and rejected: they worsen leave-one-out
and cross-validation on 87 peers.

Every term is clamped to the range it takes on the fitted peers, so no implied value comes
from extrapolating past the data.

## The odds model

Logistic regression on the 645 dated protocols (327 record a token, base rate 50.7%).
Terms: age in years + shrunk category offsets (k = 5).

| Validation | Brier |
|---|---|
| 10-fold CV (3 repeats) | 0.2068 |
| Walk-forward | 0.2376 |
| Leave-one-category-out | 0.2106 |

Category offsets are computed from the training fold only in every validation. Adding
growth, size or chains was tried and rejected: none lowers both blind tests by more
than 0.001.

## Farm economics

Every farm plan carries a net $/hour verdict: expected gross minus gas, over the hours of
attention. Expected gross is the implied value times a planning capture share of 0.001% —
the implied value already multiplies the launch value by the token odds, so it is the
expected launch value; the share is a stated assumption, never a promise. The breakeven capture
share sits beside every verdict so a reader can substitute their own. Gas is costed per
chain (Ethereum $4.00, Arbitrum $0.10, Base $0.05, Optimism $0.10, Binance $0.15,
Solana $0.02, Polygon $0.05, Avalanche $0.30, Hyperliquid L1 $0.05, other chains $0.50):
typical values, and a reader must check the chain's fee page before acting. Minimum
capital runs $50 / $100 / $150 / $250 by TVL tier; hold windows run 30 / 45 / 60 days
by protocol age.

## Integrity

The dashboard rebuilds the board in the browser from the snapshot and the same model code
and prints the checksum beside board.json's. A run is deterministic: two runs of main.ts
produce byte-identical output.

## Honest gaps

- The four-term model's leave-one-out of x2.783 and walk-forward of x2.363 reproduce
  exactly in one shared framework (same splits, same feature definitions). An earlier
  build of this entry measured x3.079 / x2.874 for the same term set because its
  validation clamped held-out rows to the training subset's range; the spec clamps to
  the range over all peers, where that clamp is a no-op for held-out rows. The figures
  above are this entry's own measured numbers.
- The earlier claimed odds walk-forward Brier of 0.218 is still not reproduced: this build
  measures 0.2376 with fold-internal category offsets (a leaky full-data offset gives
  0.2044, which is not adopted).
- No judge rate is claimed anywhere: this competition has no local grade, and the dev
  judge's pairwise verdicts cannot be measured from here.

## Run it

```
MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Node 22, standard library only. Writes board.json, data.js, dashboard/, screenshots/
and dossier.json.
