# Decision-Complete Forward Test Protocol

Status: `RESEARCH_ONLY`

## 1. Purpose

This protocol tests whether an H5 short policy improves deployable decisions, not whether selected historical trades can be made to look attractive.

## 2. Frozen source-cycle contract

Each scanner cycle receives an immutable `source_cycle_id`. Before future price bars are consumed, persist:

- source timestamp and receipt timestamp;
- point-in-time symbol universe;
- every eligible and rejected candidate;
- raw and derived feature values;
- missingness and stale flags;
- complete rejection reasons;
- deterministic ranking order;
- capacity and risk state;
- policy decision for every registered arm;
- feature, policy, universe, cost and execution hashes.

The candidate ledger is append-only. Corrections are new events linked to the original row. They do not overwrite history.

## 3. Required row grain

Primary grain:

```text
one row per arm x source_cycle_id x candidate_id
```

A rejected candidate still receives a row and `policy_reward_r=0` for policy-level comparison. It is excluded from accepted-trade expectancy.

Never mix these measures:

- accepted-trade expectancy;
- policy reward across all candidate decisions;
- counterfactual candidate outcome;
- portfolio result after capacity constraints.

## 4. Causal timing

A decision record must exist before its first outcome bar. Assert:

```text
decision_ts <= simulated_order_ts <= first_outcome_bar_open_ts <= terminal_ts
```

No feature may use a bar whose close occurs after `decision_ts`.

Late-discovered candidates are labeled `catchup=true`. Catch-up evidence remains exploratory forever. It cannot be relabeled as forward evidence in a later report.

## 5. Same-bar and fill rules

Frozen defaults:

- next executable price after the decision;
- explicit latency tier: 0, 1, 5 or 15 minutes;
- stop-first when stop and target can both occur inside an unresolved bar;
- gap-through-stop at the first executable adverse price;
- maker fill only after evidence that the order genuinely rested before the market crossed it;
- rejected or missed maker order remains unfilled, not magically filled at the favourable price.

Every report includes latency and cost stress.

## 6. Risk normalization

For stop-geometry comparisons:

```text
cash_risk_per_trade = frozen account-equity fraction
position_size = cash_risk_per_trade / abs(entry_price - structural_stop_price)
```

Report:

- initial cash risk;
- initial stop distance;
- position notional;
- margin used;
- leverage;
- terminal R;
- terminal percentage return;
- gap loss beyond planned R.

A comparison without equal initial cash risk is descriptive only.

## 7. Capacity normalization

For one-slot versus two-slot tests, total portfolio stop risk is constant:

```text
one slot = 1.00 risk unit
two slots = 0.50 + 0.50 risk units
```

Slot 2 is admitted only when it is from a different frozen correlation/event cluster, has no duplicate symbol exposure, and passes the same economic constraints.

Persist separately:

- slot-1 outcome;
- slot-2 incremental outcome;
- cost-stressed slot-2 outcome;
- slot-2 margin-hours;
- slot-2 drawdown contribution;
- slot-2 tail loss;
- suppressed slot-2 counterfactual.

## 8. Execution twins

Every on-time accepted setup must have three linked records.

### Decision twin

Frozen theoretical entry and fully simulated management.

### Fill twin

Actual achievable paper fill with the frozen simulated management.

### Paper trade

Actual achievable fill and actual paper management.

Decomposition:

```text
selection result       = decision_twin_net_r
entry/execution drag   = decision_twin_net_r - fill_twin_net_r
management drag        = fill_twin_net_r - paper_trade_net_r
```

If twin coverage is below 99%, no replay-to-paper explanation is considered complete.

## 9. Outcome horizon

Each accepted setup has one registered terminal horizon and one terminal reason taxonomy:

- stop;
- target;
- conditional time exit;
- hard terminal horizon;
- market-data failure;
- execution failure;
- operator cancellation.

Unresolved outcomes remain unresolved. Reports must include optimistic and pessimistic bounds.

## 10. Cost grid

At minimum compute round-trip friction at:

- 0.08%;
- 0.14%;
- 0.22%;
- 0.30%.

The cost model includes fees, expected slippage, spread, and observed gap effects. Funding is included when the holding interval crosses a funding timestamp.

## 11. Regime labels

Regime labels are frozen point-in-time features, not explanations invented after outcomes. Minimum useful families:

- BTC trend/volatility state;
- market breadth state;
- pump-extension state;
- funding/crowding state;
- session and weekday;
- liquidity tier;
- correlation/event cluster;
- short-active, neutral, transition or hostile market state.

Unsupported regime cells are reported as unsupported, not zero.

## 12. Statistical unit

Primary resampling unit is the whole `source_cycle_id` or a larger event cluster when one cycle can generate dependent decisions.

Sensitivity units:

- symbol-day;
- calendar day;
- market event window;
- correlation cluster;
- symbol.

Individual trades from one pump episode are never treated as independent observations.

## 13. Experiment stages

### Stage A: stop/time factorial

Run V0, V2, V3 and V2xV3 on the identical slate with equal risk.

### Stage B: selection

Run unchanged ranking, C1 feature rank-only and relative-slate ranking with identical management and capacity.

### Stage C: capacity

Run one full-risk slot versus two half-risk independent slots.

### Stage D: execution twins

Reconcile decision, fill and paper outcomes before promotion.

Only one registered survivor per stage enters a new sealed confirmation epoch. Non-inferior alternatives remain logged but do not generate a combinatorial variant explosion.

## 14. Forward cadence

Recommended operations:

- scanner poll cadence follows the strategy’s decision timeframe;
- lifecycle updates are event-driven or at least frequent enough to resolve fills and exits;
- analytical summaries run every 6 hours;
- promotion tests run only at registered evidence looks;
- configuration changes open a new epoch with new hashes.

Analysis cadence must not control trading cadence. A six-hour report is not permission to notice a fifteen-minute setup six hours late.

## 15. Storage and network efficiency

Persist compact decision-grade data:

- JSONL or Parquet with stable schemas;
- integer or dictionary encoding for repeated labels;
- gzip or zstd compression;
- deduplicated feature snapshots referenced by content hash;
- one market-data cache shared by all arms;
- delta lifecycle events instead of repeated full state;
- periodic manifests and checksums;
- bounded retention for raw transient transport logs after verified compaction.

Do not discard fields needed to reconstruct candidate eligibility, ranking, risk, costs, fills, or terminal outcome. Cheap storage is valuable. Unreconstructable evidence is cheaper still and worth exactly that.

## 16. Required outputs per epoch

- source-cycle manifest;
- candidate and decision coverage report;
- maturity report;
- hash-drift report;
- common-support matrix;
- accepted-trade metrics;
- policy-level paired metrics;
- unresolved bounds;
- cost and latency grid;
- regime and concentration tables;
- robust Pareto frontier and stability;
- direct-parent comparison;
- multiplicity report;
- promotion decision with explicit failed gates.
