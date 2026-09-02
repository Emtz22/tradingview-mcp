# Run the H5 Pareto Lab

## Requirements

- Python 3.11 or newer.
- No third-party packages are required for the included analyzer.
- The input must be a normalized CSV with one row per `arm_id x source_cycle_id x candidate_id`.

## Required columns

| Column | Meaning |
|---|---|
| `source_cycle_id` | Immutable scanner/source cycle identity. |
| `candidate_id` | Immutable candidate identity inside the cycle. |
| `arm_id` | Frozen variant or successor arm. |
| `decision_ts` | ISO-8601 timestamp when the arm decision became immutable. |
| `terminal_ts` | ISO-8601 terminal timestamp; blank while unresolved. |
| `accepted` | Boolean admission decision. |
| `matured` | Boolean terminal outcome state. |
| `net_r` | Accepted-trade terminal net R; blank for rejected or unresolved rows. |
| `initial_stop_risk` | Initial planned risk units. Use 1.0 after equal-risk normalization. |
| `feature_hash` | Frozen feature specification hash. |
| `policy_hash` | Frozen policy specification hash. |
| `cost_hash` | Frozen cost-model hash. |
| `execution_hash` | Frozen execution-model hash. |
| `universe_hash` | Point-in-time universe specification hash. |

## Strongly recommended columns

```text
parent_arm
policy_reward_r
net_r_cost_1_5x
net_r_cost_2x
symbol
regime
correlation_cluster
session
weekday
catchup
rank
slot
margin_hours
exposure_hours
active_free_parameters
storage_bytes_per_cycle
network_bytes_per_cycle
decision_twin_net_r
fill_twin_net_r
paper_trade_net_r
```

`policy_reward_r` must be zero for a rejected decision and terminal net R for a matured accepted decision. It is distinct from accepted-trade expectancy.

## Minimal example

```csv
source_cycle_id,candidate_id,arm_id,parent_arm,decision_ts,terminal_ts,accepted,matured,net_r,policy_reward_r,net_r_cost_1_5x,net_r_cost_2x,initial_stop_risk,feature_hash,policy_hash,cost_hash,execution_hash,universe_hash,symbol,regime,correlation_cluster
cycle001,BTCUSDT-001,F0_V0_RISK_PARITY_CONTROL,,2026-09-02T01:00:00Z,2026-09-02T02:00:00Z,true,true,0.80,0.80,0.72,0.64,1.0,fh1,ph0,ch1,eh1,uh1,BTCUSDT,short_active,btc
cycle001,BTCUSDT-001,F1_V2_RISK_PARITY,F0_V0_RISK_PARITY_CONTROL,2026-09-02T01:00:00Z,2026-09-02T02:00:00Z,true,true,1.10,1.10,1.02,0.94,1.0,fh1,ph1,ch1,eh1,uh1,BTCUSDT,short_active,btc
cycle002,ETHUSDT-001,F0_V0_RISK_PARITY_CONTROL,,2026-09-02T01:15:00Z,2026-09-02T02:15:00Z,false,true,,0.0,,,1.0,fh1,ph0,ch1,eh1,uh1,ETHUSDT,transition,large_cap
cycle002,ETHUSDT-001,F1_V2_RISK_PARITY,F0_V0_RISK_PARITY_CONTROL,2026-09-02T01:15:00Z,2026-09-02T02:15:00Z,false,true,,0.0,,,1.0,fh1,ph1,ch1,eh1,uh1,ETHUSDT,transition,large_cap
```

## Execute

From the bundle root:

```bash
python CODE/h5_pareto_lab.py \
  --input decisions.csv \
  --output results \
  --config CONFIG/pareto_objectives.json \
  --bootstrap 10000 \
  --seed 20260902
```

Outputs:

- `results/arm_metrics.csv`
- `results/pareto_result.json`
- `results/REPORT.md`

Run tests:

```bash
python -m unittest CODE/test_h5_pareto_lab.py
```

## Fail-closed interpretation

The analyzer may still summarize an infeasible arm, but only feasible arms enter the point epsilon frontier. Missing objective values are not treated as zero. Unresolved accepted trades receive optimistic and pessimistic bounds and are excluded from resolved expectancy.

The included code computes clustered bootstrap uncertainty and a robust workflow scaffold. White Reality Check, Hansen SPA and Model Confidence Set should be added to the final research pipeline with a validated statistical package before promotion review. Do not rename an approximate bootstrap as one of those tests. Statistics already suffers enough identity theft.

## Expected archive integration

After extracting `H5_GPT_PRO_HANDOFF_2026-09-02_221545WIB.zip`:

1. Locate all candidate, arm-decision, paper-trade, fill and lifecycle logs.
2. Verify checksums and manifest counts.
3. Deduplicate by immutable event identity, not by approximate timestamp alone.
4. Create a union candidate slate per source cycle.
5. Materialize an explicit row for each registered arm and candidate.
6. Link accepted decisions to terminal outcomes and execution twins.
7. Preserve catch-up status.
8. Normalize stop comparisons to equal initial cash risk.
9. Save the normalized ledger as `decisions.csv`.
10. Run the analyzer and statistical multiplicity suite.
11. Append the result to the experiment registry. Do not overwrite earlier epochs.
