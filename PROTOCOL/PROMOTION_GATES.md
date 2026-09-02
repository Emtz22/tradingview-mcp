# H5 Promotion and Stop Gates

Status: `RESEARCH_ONLY | OPERATOR_GATED`

## Promotion eligibility

All hard gates must pass in the same frozen epoch.

### Evidence

- At least 300 complete source cycles.
- At least 100 accepted terminal trades.
- At least 60 elapsed calendar days.
- Candidate coverage at least 99%.
- Explicit policy-decision coverage at least 99%.
- Terminal maturity at least 95%.
- Exact common-support rate at least 99% for direct-parent claims.
- Execution-twin match rate at least 99% for paper reconciliation.
- No unexpected feature, policy, cost, execution or universe hash drift.
- No post-decision feature timestamps.
- Catch-up rows excluded from forward promotion evidence.

### Economics

- 95% source-cycle-cluster bootstrap lower bound of net policy expectancy above zero.
- Positive total net result at 0.22% round-trip friction.
- Non-negative total result at 0.30% friction.
- Positive return per unit initial stop risk.
- Direct-parent paired improvement exceeds the registered epsilon.
- Pessimistic unresolved-outcome bound does not invalidate the result.

### Tail and concentration

- Maximum drawdown within the registered risk budget.
- Trade CVaR and conditional drawdown do not materially regress versus parent.
- No symbol contributes more than 15% of total net R.
- No month contributes more than 40%.
- Leave-one-symbol-out and leave-one-cluster-out minima remain acceptable.
- No hidden rise in gap loss, unresolved exposure, leverage, margin-hours or correlated capacity.

### Robustness and multiplicity

- Robust Pareto frontier stability at least 70%.
- Bootstrap probability of epsilon-dominating the direct parent at least 90%, or the arm remains in a registered non-inferior set and is materially simpler.
- Membership in the Model Confidence Set at the registered alpha.
- White Reality Check and Hansen SPA results disclosed for the searched family.
- Probability of Backtest Overfitting disclosed when chronological partitions support it.
- All inspected variants recorded in the append-only registry.

### Operational

- Point-in-time universe reconstruction passes.
- Cost and latency assumptions match the intended venue and order type.
- Fail-closed behavior verified for missing, stale and corrupt data.
- Risk cap, cluster cap and one-symbol cap verified.
- Paper-trade lifecycle has no unexplained divergence from the simulation twins.
- Human operator gives explicit promotion approval.

## Automatic non-promotion states

Any one of these forces `NO_PROMOTION`:

- evidence gate failure;
- missing source-cycle rows;
- unresolved outcomes zero-filled;
- risk parity absent for a stop comparison;
- slot accounting absent for a capacity claim;
- configuration drift inside the epoch;
- selected-only analysis presented as full-policy evidence;
- negative 1.5x cost-stressed expectancy while parent is non-negative;
- positive result depends on one symbol, month or cluster;
- replay/paper decay remains unexplained;
- arm is robustly dominated;
- latest source payload has not been reconstructed.

## Scheduled early stopping

Only two interim statistical looks are allowed.

### Look 1: 30 matured clustered decisions

Freeze the challenger when:

```text
paired challenger-minus-parent delta <= -0.05R per decision
and one-sided cluster test p <= 0.005
```

### Look 2: 50 matured clustered decisions

Freeze when the registered one-sided test rejects superiority at `p <= 0.045`.

Declare futility when:

```text
upper 90% cluster-bootstrap bound < +0.03R per decision
```

### Integrity stop

Stop immediately, independent of sample size, for causal timestamp failure, unexpected hash drift, duplicate identity, corrupt lifecycle order or risk reconstruction failure.

## Decision labels

Use only:

- `KEEP_CONTROL`
- `CONTINUE_SHADOW`
- `RETAIN_NON_INFERIOR`
- `FREEZE_FUTILITY`
- `REJECT_HARM`
- `INVALID_EVIDENCE`
- `PROMOTION_ELIGIBLE_OPERATOR_REVIEW`
- `NO_PROMOTION`

Do not use `winner`, `best`, or `production-ready` before every gate passes. Vocabulary should not front-run evidence either.
