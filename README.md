# H5 Short Strategy Pareto Breakthrough Bundle

Status: `RESEARCH_ONLY | NO_LIVE_AUTHORITY`

Prepared: 2026-09-02 (Asia/Jakarta)

This bundle turns the H5 short-strategy work into a decision-complete Pareto experiment instead of another threshold tournament.

## Important evidence boundary

The newest supplied archive is `H5_GPT_PRO_HANDOFF_2026-09-02_221545WIB.zip` (44,580,503 bytes). Its file-level payload could not be decompressed in the active analysis runtime because the local compute service failed before archive access. The bundle therefore does **not** invent recomputed metrics from that archive.

The quantitative baseline in `DATA/last_readable_metrics.csv` is the last independently readable H5 cohort from the 2026-09-02 09:22 WIB handoff. Every row is labeled with its evidence boundary. The 22:15 WIB archive is registered in `RECEIPTS/SOURCE_BOUNDARY.json` as `PENDING_ARCHIVE_RECOMPUTE`.

The rest of the bundle is still actionable: it supplies a stricter Pareto metric system, a normalized data contract, executable analysis code, registered successor experiments, forward-test gates, and explicit falsification rules.

## Main conclusion

The next high-value work is not a new confluence score. It is a four-stage mechanism test:

1. Equal-risk V0 versus V2 stop geometry.
2. A 2x2 V2-by-V3 stop/time interaction.
3. Ranking-only contextual selection on a fixed candidate slate.
4. Fixed-total-risk one-slot versus two-slot capacity.

Fastlab C1 remains frozen as a hard gate until it proves positive substitution value. V7 remains a capacity arm, not entry alpha. No arm has live authority.

## Contents

- `REPORT/H5_PARETO_BREAKTHROUGH_REPORT.md` — detailed diagnosis and breakthrough design.
- `DATA/last_readable_metrics.csv` — last independently readable H5 measurements.
- `DATA/pareto_metric_dictionary.csv` — exact metric definitions and directions.
- `CONFIG/pareto_objectives.json` — machine-readable objective and feasibility rules.
- `CONFIG/iteration_registry.json` — frozen successor experiment registry.
- `CODE/h5_pareto_lab.py` — standard-library Pareto and clustered-bootstrap analyzer.
- `CODE/test_h5_pareto_lab.py` — deterministic unit tests.
- `PROTOCOL/FORWARD_TEST_PROTOCOL.md` — decision-complete forward test.
- `PROTOCOL/PROMOTION_GATES.md` — promotion and stop rules.
- `RECEIPTS/SOURCE_BOUNDARY.json` — provenance and unavailable-source disclosure.
- `RECEIPTS/ANALYSIS_STATUS.json` — completion status by claim class.
- `SOURCES/REFERENCES.md` — statistical and research references.
- `RUNME.md` — execution instructions and input schema.

## Quick use

Normalize the next complete decision ledger to the schema in `RUNME.md`, then run:

```bash
python CODE/h5_pareto_lab.py \
  --input decisions.csv \
  --output results \
  --config CONFIG/pareto_objectives.json \
  --bootstrap 10000 \
  --seed 20260902

python -m unittest CODE/test_h5_pareto_lab.py
```

The analyzer rejects promotion when coverage, maturity, hash consistency, common support, or causal timestamps fail. A pretty profit factor cannot negotiate with missing evidence. Markets have tried that trick before.

## Download

[Download this complete bundle as one ZIP](https://github.com/Emtz22/tradingview-mcp/archive/refs/heads/h5-pareto-bundle-20260902.zip)
