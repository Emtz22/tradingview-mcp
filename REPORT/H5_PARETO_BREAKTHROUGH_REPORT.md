# H5 Short Strategy Pareto Breakthrough Report

Status: `RESEARCH_ONLY | FORWARD_SHADOW_REQUIRED | NO_EXECUTION_AUTHORITY`

Date: 2026-09-02, Asia/Jakarta

## 1. Executive verdict

The current H5 research does not need more loosely coupled short variants. It needs a stricter experiment that separates four mechanisms:

1. **Signal selection** — which setup is chosen from the same point-in-time slate.
2. **Trade management** — stop and time-exit geometry after the same entry decision.
3. **Risk sizing** — how much cash risk and margin each accepted setup consumes.
4. **Capacity** — whether a second position adds independent return or only correlated exposure.

The last independently readable cohort suggested:

- V2 was the strongest equal-count historical/prospective parent.
- V3 was the most useful independent management factor.
- V7 achieved similar raw cumulative return with materially more entries and weakened under cost stress.
- Fastlab C1 underperformed C0 despite accepting fewer decisions.
- The canonical on-time paper book remained negative and tiny.

Those facts do **not** prove V2. They identify the next controlled questions. The proper successor is an equal-risk V0/V2/V3 factorial cohort followed by ranking and capacity tests. No arm qualifies for live promotion.

## 2. Evidence boundary

### 2.1 Newest supplied source

Archive: `H5_GPT_PRO_HANDOFF_2026-09-02_221545WIB.zip`

Observed stored size: 44,580,503 bytes.

The active local compute runtime failed before it could decompress or independently recompute the archive. This report therefore makes no numeric claim about changes that may exist only inside the 22:15 WIB payload. Such claims are marked `PENDING_ARCHIVE_RECOMPUTE` in the receipts.

### 2.2 Last independently readable H5 cohort

The quantitative rows retained in this bundle come from the prior 2026-09-02 09:22 WIB H5 handoff:

- Fastlab C0: 14 decisions, 8 accepted, -2.609R standard, -3.270R stressed.
- Fastlab C1: 14 decisions, 6 accepted, -3.575R standard, -4.149R stressed.
- Prospective V0: n=54, +28.09%, +22.15% stressed.
- Prospective V2: n=54, +53.65%, +47.71% stressed.
- Prospective V7: n=99, +54.10%, +43.21% stressed.
- Canonical on-time paper: n=8, 2 wins, 6 losses, -8.20%, -9.08% stressed.
- Paper v2: n=4, 0 wins, 4 losses, -5.17%.
- Paper v3: n=4, 2 wins, 2 losses, -3.03%.

These rows are useful for prioritization, not promotion. Their populations and units differ; they must not be placed on one naive return leaderboard.

## 3. What the earlier Pareto view missed

A strategy can look attractive on return, profit factor, or drawdown while failing the policy question. Five distortions matter here.

### 3.1 Unequal risk masquerading as edge

If V2 uses a wider stop but unchanged notional, it carries more cash risk. Percentage return then combines stop geometry with leverage. Every stop comparison must use fixed initial cash risk:

```text
position_size = fixed_cash_risk / structural_stop_distance
```

Report terminal R and percentage return. V2 is a valid improvement only if it survives this normalization.

### 3.2 Capacity masquerading as selection

V7 had 99 records versus 54 for V2. Similar cumulative return with nearly twice the entries is not evidence of better selection. The second slot must be scored as incremental contribution under unchanged total portfolio stop risk.

### 3.3 Rejection masquerading as a better screener

Fastlab C1 accepted fewer candidates yet lost more. A gate is useful only when it either:

- avoids a bad trade without suppressing a better feasible replacement; or
- selects a better candidate from the same cycle.

The correct metric is substitution value, not the return of survivors.

### 3.4 Selected-only outcomes overstate deployable policy quality

A filter evaluated only on trades selected by an earlier behavior policy cannot measure refill, opportunity cost, or the lower-ranked candidate that would have replaced a rejection. Every policy must write a decision for every frozen candidate and every source cycle.

### 3.5 Tiny forward evidence can contradict attractive replay

The paper v2 split was 0/4 and negative while the prospective aggregate was strongly positive. Four trades are too few to reject V2, but enough to force an execution and cohort reconciliation before promotion.

## 4. Pareto system v2

### 4.1 Feasibility before dominance

An arm is excluded from the Pareto frontier if any hard evidence gate fails:

- candidate coverage below 99%;
- policy-decision coverage below 99%;
- terminal maturity below 95%;
- feature, policy, cost, execution, or universe hash drift;
- post-decision data in a decision record;
- mismatched candidate support for a paired comparison;
- unresolved outcomes silently filled with zero;
- risk normalization unavailable for a stop-geometry comparison;
- slot-level accounting unavailable for a capacity claim.

This prevents a defective but profitable-looking arm from dominating a clean arm.

### 4.2 Objective families

The frontier is built from objective families rather than one blended score.

#### Evidence quality

Maximize:

- candidate and decision coverage;
- terminal maturity;
- exact common-support rate;
- execution-twin match rate;
- stable frontier membership under cluster bootstrap.

Minimize:

- ambiguous lifecycle rate;
- stale-catch-up share;
- hash drift;
- unresolved exposure;
- effective number of analyst trials.

#### Risk-adjusted economics

Maximize:

- net expectancy in R;
- 95% cluster-bootstrap lower confidence bound of net expectancy;
- stressed expectancy at 1.5x and 2.0x friction;
- break-even cost multiple;
- return per unit stop risk;
- return per margin-hour;
- return per exposure-hour;
- downside-risk-adjusted return.

Minimize:

- maximum drawdown in R;
- conditional drawdown at risk;
- 5% trade CVaR;
- drawdown duration;
- gap-through-stop loss;
- left-tail concentration.

#### Robustness

Maximize:

- worst-regime expectancy;
- worst-calendar-month expectancy;
- leave-one-symbol-out minimum expectancy;
- leave-one-correlation-cluster-out minimum expectancy;
- positive-fold share;
- cross-cost frontier stability.

Minimize:

- one-symbol contribution share;
- one-month contribution share;
- regime dispersion;
- performance decay from replay to on-time paper.

#### Selection and capacity

Maximize:

- paired policy delta on exact common support;
- selected-versus-best-feasible-suppressed delta;
- refill contribution;
- rank-decile monotonicity;
- slot-2 incremental stressed R;
- diversification benefit at fixed total risk.

Minimize:

- missed-winner rate;
- weak-replacement rate;
- cluster duplication;
- extra turnover per unit incremental R;
- capacity-induced tail loss.

#### Simplicity

Minimize:

- active free parameters;
- branch conditions;
- required feature families;
- state transitions not directly logged;
- incremental network and disk cost;
- trial-family multiplicity burden.

A more complex arm must produce a material epsilon improvement, not merely 0.001R of decorative superiority.

### 4.3 Robust dominance

Point-estimate Pareto dominance is too unstable for a small, clustered trade book. Use three layers:

1. **Epsilon dominance:** differences smaller than the registered materiality band count as ties.
2. **Bootstrap dominance probability:** compare whole source-cycle clusters. An arm is robustly dominated only when another feasible arm is no worse on all objectives and materially better on at least one in at least 90% of bootstrap draws.
3. **Frontier stability:** report the percentage of bootstrap draws in which each arm appears on the frontier.

Promotion requires membership in the Model Confidence Set or equivalent non-inferior set. Frontier membership alone is not enough.

### 4.4 Missing-outcome bounds

Unresolved outcomes are not zero. For each arm report:

- resolved-only result;
- optimistic bound using registered maximum favourable terminal R;
- pessimistic bound using registered maximum adverse terminal R;
- promotion result using the pessimistic bound whenever maturity is below target.

If an arm is attractive only under resolved-only accounting, it is not attractive. It is unfinished.

## 5. Variant diagnosis

### V0 — immutable control

Purpose: preserve the original decision and management contract. Do not tune it. Its main value is causal comparison.

### V2 — primary mechanism candidate

Why it remains first:

- same reported count as V0;
- materially higher standard and stressed aggregate result in the last readable cohort;
- cost haircut was similar in absolute percentage points, so the difference was not obviously created by lighter friction.

Primary threat: unequal cash risk from wider stop geometry.

Required successor: `F1_V2_RISK_PARITY`.

Falsification: retire V2 as an edge claim when equal-risk paired expectancy, lower confidence bound, and tail metrics fail to beat V0 by registered epsilon.

### V3 — independent management candidate

V3 should not be judged as a standalone strategy family. Treat it as a time-management factor applied to the same entries.

Required successor: 2x2 stop/time factorial:

- baseline stop + baseline time;
- V2 stop + baseline time;
- baseline stop + V3 time;
- V2 stop + V3 time.

A 45-minute checkpoint must be conditional on closed-bar thesis decay. It must not become “exit every trade at 45 minutes because the backtest liked the number.”

### V7 — capacity candidate only

V7’s reported raw total was close to V2 but used many more records and lost relative ground under stressed cost. Rebuild it as:

```text
one slot: 1.00 unit total stop risk
two slots: 0.50 + 0.50 units total stop risk
```

Slot 2 must be from a distinct correlation/event cluster and must have separate PnL, cost, drawdown, margin-hour, and tail-loss accounting.

### Fastlab C1 — hard gate frozen

C1 lost more than C0 while accepting fewer decisions. Do not search adjacent thresholds. Convert the C1 feature into a rank-only diagnostic on the complete C0 slate.

Required metrics:

- C0-only candidate outcome;
- C1-selected replacement outcome;
- selected minus suppressed R;
- saved-loss and missed-winner counts;
- rank monotonicity;
- common-support paired delta.

The hard gate returns only after positive substitution value survives forward shadow evidence.

### V8–V11

Keep exact existing arms frozen. Do not create descendants until their rule definitions, hashes, common-support counts, and forward evidence are available in the normalized ledger. V11-style protection belongs to a management overlay, not an entry-alpha leaderboard.

## 6. Breakthrough successor architecture

### Stage A — risk and management mechanism

Four frozen arms:

- `F0_V0_RISK_PARITY_CONTROL`
- `F1_V2_RISK_PARITY`
- `F2_V3_TIME_CONDITIONAL`
- `F3_V2_X_V3`

All consume identical candidates and use identical fixed cash risk, cost model, latency model, and terminal horizon.

Decision rule after minimum evidence:

- retain non-inferior arms in the Model Confidence Set;
- prefer the simplest arm when objective differences remain inside epsilon;
- reject any arm whose benefit disappears at 1.5x costs or whose 5% CVaR materially worsens.

### Stage B — relative slate selection

Apply the Stage A winner to the same candidate slate under three policies:

- unchanged absolute ordering control;
- C1 measurement rank-only;
- `RELATIVE_SLATE_S1O`, a lexicographic short selector.

Lexicographic fields:

1. short-active market state;
2. fresh 1H supply and first-sweep lifecycle;
3. closed bearish proof;
4. residual weakness versus BTC and breadth;
5. cost-R and opposing-liquidity target room;
6. causal symbol/cluster memory, rank-only;
7. quote liquidity and freshness;
8. deterministic symbol tie-break.

No blended weight may compensate for a failed hard economic constraint.

### Stage C — fixed-risk capacity

Compare:

- one full-risk slot;
- two half-risk independent slots;
- one full-risk slot plus slot-2 counterfactual logging only.

This isolates capacity value from leverage and gives a direct estimate of slot-2 opportunity cost.

### Stage D — execution twins

For every accepted on-time setup, write:

1. **Decision twin:** frozen theoretical entry and simulated lifecycle.
2. **Fill twin:** achievable paper fill with frozen simulated management.
3. **Paper trade:** achievable fill and actual paper management.

Then decompose:

```text
selection result       = decision twin
entry/execution drag   = fill twin - decision twin
management drag        = paper trade - fill twin
```

This is the only clean way to reconcile attractive replay with a weak paper book.

## 7. Statistical controls

### 7.1 Clustering

Primary resampling unit: exact source cycle or symbol-day, whichever prevents multiple correlated decisions from being treated as independent.

Secondary sensitivity clusters:

- calendar day;
- market event window;
- correlation cluster;
- symbol.

### 7.2 Multiple testing

Maintain an append-only experiment registry. Report:

- total registered arms;
- total inspected arms;
- effective trial-family count;
- White Reality Check against the immutable control;
- Hansen Superior Predictive Ability test;
- Model Confidence Set;
- Probability of Backtest Overfitting when enough chronological folds exist;
- Deflated Sharpe Ratio only when return scaling and non-normality inputs are defensible.

Do not use raw in-sample Sharpe as a promotion key.

### 7.3 Chronological validation

Use anchored walk-forward folds. Never random-shuffle time. Final confirmation data remains sealed until the arm family is frozen.

Suggested split logic:

- development folds for mechanism diagnosis;
- locked OOS for one registered winner per stage;
- on-time forward shadow as promotion evidence;
- late-discovered catch-up rows quarantined as exploratory forever.

## 8. Pareto promotion rules

An arm cannot be discussed for promotion until it has:

- at least 300 frozen source cycles;
- at least 100 accepted terminal trades;
- at least 60 elapsed calendar days;
- candidate and decision coverage at least 99%;
- terminal maturity at least 95%;
- no material hash drift;
- 95% cluster-bootstrap lower bound of net expectancy above zero;
- positive result at 0.22% round-trip friction;
- non-negative result at 0.30%;
- no symbol above 15% of total net R;
- no month above 40%;
- no material negative chop or transition leakage;
- no hidden increase in unresolved, margin, or correlated exposure;
- robust frontier stability at least 70%;
- membership in the retained non-inferior model set;
- direct-parent improvement outside registered epsilon on at least one primary objective without material regression on any guardrail.

Failure freezes promotion, not data collection.

## 9. Pareto stop rules

Retire or freeze an arm early when any applies:

- causal or hash integrity fails;
- common-support coverage is below 95% for a paired claim;
- slot-level risk cannot be reconstructed;
- pessimistic unresolved bound is dominated;
- after 30 matured clustered decisions, paired delta is at most -0.05R per decision with one-sided alpha 0.005;
- after 50 matured decisions, one-sided alpha 0.045 rejects superiority;
- at 50 matured decisions, the upper 90% cluster-bootstrap bound is below +0.03R per decision;
- 1.5x cost stress turns the arm negative while the parent stays positive;
- leave-one-cluster-out minimum falls below the registered catastrophic threshold;
- complexity rises without a material Pareto contribution.

Only two scheduled statistical looks are allowed before the final gate. Repeatedly checking until significance appears is not monitoring; it is p-hacking with a cron job.

## 10. Final research priority

```text
CONTROL:                 V0, immutable
PRIMARY MECHANISM:       V2 under equal cash risk
SECONDARY FACTOR:        V3 conditional time management
NEXT CORE TEST:          V2 x V3 factorial
SELECTION TEST:          C1 feature rank-only + relative slate
CAPACITY TEST:           V7 fixed-total-risk slot accounting
EXECUTION TEST:          decision/fill/paper twins
LATEST ARCHIVE NUMBERS:  PENDING_ARCHIVE_RECOMPUTE
LIVE AUTHORITY:          NONE
```

The key breakthrough is architectural: strategy selection becomes a robust, decision-complete Pareto problem. Return is one objective. Evidence completeness, tail risk, cost survival, substitution value, exposure efficiency, robustness, and complexity are equal citizens. That is less glamorous than discovering V37. It is also far more likely to survive contact with money.
