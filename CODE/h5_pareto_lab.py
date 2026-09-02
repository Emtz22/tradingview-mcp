#!/usr/bin/env python3
"""Decision-complete Pareto analysis for H5 short-strategy cohorts.

Standard-library only. Research use only. This program never places orders,
calls an exchange, or grants promotion authority.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import random
import statistics
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable, Sequence

REQUIRED = {
    "source_cycle_id", "candidate_id", "arm_id", "decision_ts", "terminal_ts",
    "accepted", "matured", "net_r", "initial_stop_risk", "feature_hash",
    "policy_hash", "cost_hash", "execution_hash", "universe_hash",
}
HASH_COLUMNS = (
    "feature_hash", "policy_hash", "cost_hash", "execution_hash", "universe_hash",
)


def parse_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    if text in {"1", "true", "t", "yes", "y"}:
        return True
    if text in {"0", "false", "f", "no", "n", ""}:
        return False
    raise ValueError(f"invalid boolean: {value!r}")


def parse_float(value: Any) -> float | None:
    if value is None or str(value).strip() == "":
        return None
    number = float(str(value).strip().replace(",", ""))
    if not math.isfinite(number):
        raise ValueError(f"non-finite numeric value: {value!r}")
    return number


def parse_ts(value: Any) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    return datetime.fromisoformat(text)


def average(values: Sequence[float]) -> float | None:
    return statistics.fmean(values) if values else None


def quantile(values: Sequence[float], probability: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * probability
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    weight = position - lower
    return ordered[lower] * (1.0 - weight) + ordered[upper] * weight


def max_drawdown(returns: Iterable[float]) -> float:
    equity = 0.0
    peak = 0.0
    drawdown = 0.0
    for result in returns:
        equity += result
        peak = max(peak, equity)
        drawdown = max(drawdown, peak - equity)
    return drawdown


def cvar_loss(returns: Sequence[float], tail: float = 0.05) -> float | None:
    """Return positive lower-tail loss severity."""
    if not returns:
        return None
    count = max(1, math.ceil(len(returns) * tail))
    return -statistics.fmean(sorted(returns)[:count])


def profit_factor(returns: Sequence[float]) -> float | None:
    gains = sum(value for value in returns if value > 0)
    losses = -sum(value for value in returns if value < 0)
    if losses == 0:
        return math.inf if gains > 0 else None
    return gains / losses


def dump_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, indent=2, sort_keys=True, default=str) + "\n",
        encoding="utf-8",
    )


@dataclass(frozen=True)
class Row:
    raw: dict[str, str]
    source_cycle_id: str
    candidate_id: str
    arm_id: str
    decision_ts: datetime | None
    terminal_ts: datetime | None
    accepted: bool
    matured: bool
    net_r: float | None
    stress15_r: float | None
    stress20_r: float | None
    initial_stop_risk: float | None
    policy_reward_r: float | None
    regime: str
    symbol: str
    correlation_cluster: str
    parent_arm: str

    @property
    def key(self) -> tuple[str, str]:
        return self.source_cycle_id, self.candidate_id


def load_rows(path: Path) -> tuple[list[Row], list[str]]:
    rows: list[Row] = []
    warnings: list[str] = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        columns = set(reader.fieldnames or [])
        missing = sorted(REQUIRED - columns)
        if missing:
            raise ValueError(f"missing required columns: {missing}")
        seen: set[tuple[str, str, str]] = set()
        for line_number, raw in enumerate(reader, start=2):
            try:
                arm = raw["arm_id"].strip()
                cycle = raw["source_cycle_id"].strip()
                candidate = raw["candidate_id"].strip()
                if not arm or not cycle or not candidate:
                    raise ValueError("blank arm, source cycle, or candidate identity")
                identity = (arm, cycle, candidate)
                if identity in seen:
                    raise ValueError(f"duplicate arm-cycle-candidate identity: {identity}")
                seen.add(identity)

                accepted = parse_bool(raw["accepted"])
                matured = parse_bool(raw["matured"])
                net_r = parse_float(raw.get("net_r"))
                if accepted and matured and net_r is None:
                    raise ValueError("accepted matured row has blank net_r")
                if accepted and not matured and net_r is not None:
                    warnings.append(
                        f"line {line_number}: unresolved accepted row had net_r; ignored"
                    )
                    net_r = None
                if not accepted and net_r is not None:
                    warnings.append(
                        f"line {line_number}: rejected row had net_r; retained only as raw counterfactual field"
                    )
                    net_r = None

                explicit_policy_reward = parse_float(raw.get("policy_reward_r"))
                if accepted and matured:
                    policy_reward = (
                        explicit_policy_reward if explicit_policy_reward is not None else net_r
                    )
                elif accepted and not matured:
                    if explicit_policy_reward is not None:
                        warnings.append(
                            f"line {line_number}: unresolved policy reward ignored; use bounds"
                        )
                    policy_reward = None
                else:
                    if explicit_policy_reward not in (None, 0.0):
                        raise ValueError("rejected decision must have zero policy_reward_r")
                    policy_reward = 0.0

                decision_ts = parse_ts(raw.get("decision_ts"))
                terminal_ts = parse_ts(raw.get("terminal_ts"))
                if decision_ts is None:
                    warnings.append(f"line {line_number}: blank decision timestamp")
                if terminal_ts and decision_ts and terminal_ts < decision_ts:
                    warnings.append(
                        f"line {line_number}: terminal timestamp precedes decision timestamp"
                    )

                rows.append(
                    Row(
                        raw=dict(raw),
                        source_cycle_id=cycle,
                        candidate_id=candidate,
                        arm_id=arm,
                        decision_ts=decision_ts,
                        terminal_ts=terminal_ts,
                        accepted=accepted,
                        matured=matured,
                        net_r=net_r,
                        stress15_r=parse_float(raw.get("net_r_cost_1_5x")),
                        stress20_r=parse_float(raw.get("net_r_cost_2x")),
                        initial_stop_risk=parse_float(raw.get("initial_stop_risk")),
                        policy_reward_r=policy_reward,
                        regime=raw.get("regime", "UNKNOWN").strip() or "UNKNOWN",
                        symbol=raw.get("symbol", "UNKNOWN").strip() or "UNKNOWN",
                        correlation_cluster=(
                            raw.get("correlation_cluster", "UNKNOWN").strip() or "UNKNOWN"
                        ),
                        parent_arm=raw.get("parent_arm", "").strip(),
                    )
                )
            except Exception as exc:  # noqa: BLE001
                warnings.append(
                    f"line {line_number}: INVALID_ROW {type(exc).__name__}: {exc}"
                )
    return rows, warnings


def hash_quality(rows: Sequence[Row]) -> tuple[int, int]:
    drift = 0
    missing = 0
    for column in HASH_COLUMNS:
        values = [row.raw.get(column, "").strip() for row in rows]
        missing += sum(not value for value in values)
        distinct = {value for value in values if value}
        drift += max(0, len(distinct) - 1)
    return drift, missing


def ordered_resolved(rows: Sequence[Row]) -> list[Row]:
    def timestamp(row: Row) -> float:
        value = row.terminal_ts or row.decision_ts
        return value.timestamp() if value is not None else float("-inf")

    return sorted(
        [row for row in rows if row.accepted and row.matured and row.net_r is not None],
        key=lambda row: (timestamp(row), row.source_cycle_id, row.candidate_id),
    )


def common_support_rate(rows: Sequence[Row], all_keys: set[tuple[str, str]]) -> float:
    keys = {row.key for row in rows}
    return len(keys) / len(all_keys) if all_keys else 0.0


def grouped_policy_expectancy(rows: Sequence[Row], field: str) -> float | None:
    grouped: dict[str, list[float]] = defaultdict(list)
    for row in rows:
        if row.policy_reward_r is not None:
            grouped[getattr(row, field)].append(row.policy_reward_r)
    means = [statistics.fmean(values) for values in grouped.values() if values]
    return min(means) if means else None


def leave_one_group_min(rows: Sequence[Row], field: str) -> float | None:
    groups = sorted({getattr(row, field) for row in rows})
    if len(groups) < 2:
        return None
    results: list[float] = []
    for omitted in groups:
        values = [
            row.policy_reward_r
            for row in rows
            if getattr(row, field) != omitted and row.policy_reward_r is not None
        ]
        if values:
            results.append(statistics.fmean(values))
    return min(results) if results else None


def numeric_column(rows: Sequence[Row], column: str) -> list[float]:
    values: list[float] = []
    for row in rows:
        value = parse_float(row.raw.get(column))
        if value is not None:
            values.append(value)
    return values


def summarize_arm(
    rows: Sequence[Row],
    all_keys: set[tuple[str, str]],
    config: dict[str, Any],
) -> dict[str, Any]:
    accepted = [row for row in rows if row.accepted]
    matured = [
        row for row in accepted if row.matured and row.net_r is not None
    ]
    unresolved = [row for row in accepted if not row.matured]
    ordered = ordered_resolved(rows)
    net = [row.net_r for row in ordered if row.net_r is not None]
    policy = [row.policy_reward_r for row in rows if row.policy_reward_r is not None]
    stress15 = [row.stress15_r for row in matured if row.stress15_r is not None]
    stress20 = [row.stress20_r for row in matured if row.stress20_r is not None]
    stop_risk = [
        row.initial_stop_risk
        for row in matured
        if row.initial_stop_risk not in (None, 0.0)
    ]
    drift, missing_hashes = hash_quality(rows)
    maturity = len(matured) / len(accepted) if accepted else 1.0
    result: dict[str, Any] = {
        "arm_id": rows[0].arm_id if rows else "",
        "parent_arm": next((row.parent_arm for row in rows if row.parent_arm), ""),
        "source_cycles": len({row.source_cycle_id for row in rows}),
        "candidate_rows": len(rows),
        "accepted": len(accepted),
        "matured": len(matured),
        "unresolved": len(unresolved),
        "terminal_maturity": maturity,
        "common_support_rate": common_support_rate(rows, all_keys),
        "hash_drift_count": drift,
        "missing_hash_value_count": missing_hashes,
        "causal_timestamp_errors": sum(
            1
            for row in rows
            if row.decision_ts is None
            or (row.terminal_ts and row.decision_ts and row.terminal_ts < row.decision_ts)
        ),
        "net_expectancy_r": average(net),
        "policy_expectancy_r": average(policy),
        "net_total_r": sum(net),
        "profit_factor": profit_factor(net),
        "win_rate": sum(value > 0 for value in net) / len(net) if net else None,
        "stressed_expectancy_1_5x_r": average(stress15),
        "stressed_expectancy_2x_r": average(stress20),
        "return_per_stop_risk": (
            sum(net) / sum(stop_risk) if stop_risk and sum(stop_risk) else None
        ),
        "max_drawdown_r": max_drawdown(net),
        "trade_cvar05_r": cvar_loss(net),
        "worst_regime_expectancy_r": grouped_policy_expectancy(rows, "regime"),
        "leave_one_cluster_out_min_r": leave_one_group_min(
            rows, "correlation_cluster"
        ),
        "leave_one_symbol_out_min_r": leave_one_group_min(rows, "symbol"),
        "active_free_parameters": max(
            numeric_column(rows, "active_free_parameters"), default=0.0
        ),
        "storage_bytes_per_cycle": average(
            numeric_column(rows, "storage_bytes_per_cycle")
        ),
    }

    optimistic = float(config["missing_outcomes"]["optimistic_bound_r"])
    pessimistic = float(config["missing_outcomes"]["pessimistic_bound_r"])
    terminal_count = len(matured) + len(unresolved)
    result["expectancy_optimistic_bound_r"] = (
        (sum(net) + len(unresolved) * optimistic) / terminal_count
        if terminal_count
        else None
    )
    result["expectancy_pessimistic_bound_r"] = (
        (sum(net) + len(unresolved) * pessimistic) / terminal_count
        if terminal_count
        else None
    )

    rules = config["feasibility"]
    failures: list[str] = []
    if result["terminal_maturity"] < rules["terminal_maturity_min"]:
        failures.append("terminal_maturity")
    if result["common_support_rate"] < rules["common_support_research_min"]:
        failures.append("common_support")
    if result["hash_drift_count"] > rules["hash_drift_max"]:
        failures.append("hash_drift")
    if result["missing_hash_value_count"]:
        failures.append("missing_hash_values")
    if result["causal_timestamp_errors"]:
        failures.append("causal_timestamp")
    result["feasibility_failures"] = failures
    result["feasible"] = not failures
    return result


def cluster_bootstrap_means(
    rows: Sequence[Row], draws: int, seed: int
) -> list[float]:
    grouped: dict[str, list[float]] = defaultdict(list)
    for row in rows:
        if row.policy_reward_r is not None:
            grouped[row.source_cycle_id].append(row.policy_reward_r)
    clusters = sorted(grouped)
    if not clusters:
        return []
    rng = random.Random(seed)
    output: list[float] = []
    for _ in range(draws):
        sample = [rng.choice(clusters) for _ in clusters]
        values = [value for cluster in sample for value in grouped[cluster]]
        if values:
            output.append(statistics.fmean(values))
    return output


def attach_uncertainty(
    summaries: dict[str, dict[str, Any]],
    by_arm: dict[str, list[Row]],
    draws: int,
    seed: int,
) -> None:
    for index, arm in enumerate(sorted(by_arm)):
        values = cluster_bootstrap_means(by_arm[arm], draws, seed + index * 1009)
        summaries[arm]["expectancy_lcb95_r"] = quantile(values, 0.05)
        summaries[arm]["expectancy_ucb95_r"] = quantile(values, 0.95)


def comparable_value(
    summary: dict[str, Any], metric: str, direction: str
) -> float | None:
    value = summary.get(metric)
    if value is None or isinstance(value, bool):
        return None
    number = float(value)
    if not math.isfinite(number):
        return None
    return number if direction == "max" else -number


def epsilon_dominates(
    left: dict[str, Any],
    right: dict[str, Any],
    directions: dict[str, str],
    epsilon: dict[str, float],
) -> bool:
    no_worse = True
    materially_better = False
    compared = 0
    for metric, direction in directions.items():
        left_value = comparable_value(left, metric, direction)
        right_value = comparable_value(right, metric, direction)
        if left_value is None or right_value is None:
            continue
        compared += 1
        band = float(epsilon.get(metric, 0.0))
        if left_value < right_value - band:
            no_worse = False
            break
        if left_value > right_value + band:
            materially_better = True
    return compared > 0 and no_worse and materially_better


def point_frontier(
    summaries: dict[str, dict[str, Any]], config: dict[str, Any]
) -> list[str]:
    required = config.get("frontier_required_metrics", [])
    feasible = {
        arm: summary
        for arm, summary in summaries.items()
        if summary.get("feasible")
        and all(
            comparable_value(
                summary, metric, config["objective_directions"][metric]
            )
            is not None
            for metric in required
        )
    }
    frontier: list[str] = []
    for arm, summary in feasible.items():
        dominated = any(
            other_arm != arm
            and epsilon_dominates(
                other_summary,
                summary,
                config["objective_directions"],
                config["epsilon"],
            )
            for other_arm, other_summary in feasible.items()
        )
        if not dominated:
            frontier.append(arm)
    return sorted(frontier)


def paired_delta(rows_a: Sequence[Row], rows_b: Sequence[Row]) -> dict[str, Any]:
    arm_a = {
        row.key: row.policy_reward_r
        for row in rows_a
        if row.policy_reward_r is not None
    }
    arm_b = {
        row.key: row.policy_reward_r
        for row in rows_b
        if row.policy_reward_r is not None
    }
    common = sorted(set(arm_a) & set(arm_b))
    deltas = [float(arm_a[key]) - float(arm_b[key]) for key in common]
    union = set(arm_a) | set(arm_b)
    return {
        "common_n": len(common),
        "union_n": len(union),
        "common_support_rate": len(common) / len(union) if union else 0.0,
        "mean_delta_r": average(deltas),
        "median_delta_r": statistics.median(deltas) if deltas else None,
        "positive_delta_share": (
            sum(value > 0 for value in deltas) / len(deltas) if deltas else None
        ),
    }


def paired_cluster_bootstrap(
    rows_a: Sequence[Row],
    rows_b: Sequence[Row],
    draws: int,
    seed: int,
) -> dict[str, Any]:
    arm_a = {
        row.key: row.policy_reward_r
        for row in rows_a
        if row.policy_reward_r is not None
    }
    arm_b = {
        row.key: row.policy_reward_r
        for row in rows_b
        if row.policy_reward_r is not None
    }
    grouped: dict[str, list[float]] = defaultdict(list)
    for cycle, candidate in set(arm_a) & set(arm_b):
        grouped[cycle].append(
            float(arm_a[(cycle, candidate)]) - float(arm_b[(cycle, candidate)])
        )
    clusters = sorted(grouped)
    if not clusters:
        return {"draws": 0, "lcb95_r": None, "ucb95_r": None, "p_delta_gt_0": None}
    rng = random.Random(seed)
    samples: list[float] = []
    for _ in range(draws):
        selected = [rng.choice(clusters) for _ in clusters]
        values = [value for cluster in selected for value in grouped[cluster]]
        if values:
            samples.append(statistics.fmean(values))
    return {
        "draws": len(samples),
        "lcb95_r": quantile(samples, 0.05),
        "ucb95_r": quantile(samples, 0.95),
        "p_delta_gt_0": (
            sum(value > 0 for value in samples) / len(samples) if samples else None
        ),
    }


def bootstrap_frontier_stability(
    rows: Sequence[Row],
    config: dict[str, Any],
    draws: int,
    seed: int,
) -> dict[str, float]:
    clusters = sorted({row.source_cycle_id for row in rows})
    arms = sorted({row.arm_id for row in rows})
    if not clusters:
        return {arm: 0.0 for arm in arms}
    grouped: dict[str, list[Row]] = defaultdict(list)
    for row in rows:
        grouped[row.source_cycle_id].append(row)
    rng = random.Random(seed + 7411)
    counts = Counter()
    valid = 0
    for _ in range(draws):
        sampled_rows: list[Row] = []
        for _cluster in clusters:
            sampled_rows.extend(grouped[rng.choice(clusters)])
        by_arm: dict[str, list[Row]] = defaultdict(list)
        for row in sampled_rows:
            by_arm[row.arm_id].append(row)
        all_keys = {row.key for row in sampled_rows}
        summaries = {
            arm: summarize_arm(arm_rows, all_keys, config)
            for arm, arm_rows in by_arm.items()
        }
        # Each outer resample is itself one draw from the sampling distribution.
        for summary in summaries.values():
            summary["expectancy_lcb95_r"] = summary.get("policy_expectancy_r")
        frontier = point_frontier(summaries, config)
        if frontier:
            valid += 1
            counts.update(frontier)
    return {
        arm: counts[arm] / valid if valid else 0.0
        for arm in arms
    }


def write_csv(path: Path, rows: Sequence[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields: list[str] = []
    seen: set[str] = set()
    for row in rows:
        for field in row:
            if field not in seen:
                seen.add(field)
                fields.append(field)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def format_value(value: Any) -> str:
    if value is None:
        return "NA"
    if isinstance(value, bool):
        return "YES" if value else "NO"
    if isinstance(value, float):
        return f"{value:.4f}" if math.isfinite(value) else str(value)
    return str(value)


def render_report(
    summaries: dict[str, dict[str, Any]],
    frontier: Sequence[str],
    comparisons: dict[str, Any],
    warnings: Sequence[str],
) -> str:
    lines = [
        "# H5 Pareto Lab Result",
        "",
        "Status: `RESEARCH_ONLY | NO_LIVE_AUTHORITY`",
        "",
        f"Point epsilon frontier: {', '.join(frontier) if frontier else 'EMPTY'}",
        "",
        "## Arm summary",
        "",
        "| Arm | Feasible | Rows | Accepted | Matured | Policy E[R] | LCB95 | Stress 1.5x | Max DD | CVaR05 | Frontier stability |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for arm in sorted(summaries):
        summary = summaries[arm]
        fields = [
            arm,
            summary.get("feasible"),
            summary.get("candidate_rows"),
            summary.get("accepted"),
            summary.get("matured"),
            summary.get("policy_expectancy_r"),
            summary.get("expectancy_lcb95_r"),
            summary.get("stressed_expectancy_1_5x_r"),
            summary.get("max_drawdown_r"),
            summary.get("trade_cvar05_r"),
            summary.get("frontier_stability"),
        ]
        lines.append("| " + " | ".join(format_value(value) for value in fields) + " |")
    lines.extend(
        [
            "",
            "## Direct-parent paired comparisons",
            "",
            "```json",
            json.dumps(comparisons, indent=2, default=str),
            "```",
        ]
    )
    if warnings:
        lines.extend(["", "## Data warnings", ""])
        lines.extend(f"- {warning}" for warning in warnings)
    lines.extend(
        [
            "",
            "## Decision boundary",
            "",
            "Frontier membership is descriptive. Promotion still requires the frozen forward gates, multiplicity controls, sufficient elapsed time, and explicit operator review.",
        ]
    )
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--config", required=True, type=Path)
    parser.add_argument("--bootstrap", type=int, default=10000)
    parser.add_argument("--seed", type=int, default=20260902)
    args = parser.parse_args()

    config = json.loads(args.config.read_text(encoding="utf-8"))
    rows, warnings = load_rows(args.input)
    if not rows:
        raise SystemExit("no valid rows")

    by_arm: dict[str, list[Row]] = defaultdict(list)
    for row in rows:
        by_arm[row.arm_id].append(row)
    all_keys = {row.key for row in rows}
    summaries = {
        arm: summarize_arm(arm_rows, all_keys, config)
        for arm, arm_rows in by_arm.items()
    }
    attach_uncertainty(summaries, by_arm, args.bootstrap, args.seed)
    stability = bootstrap_frontier_stability(
        rows, config, min(args.bootstrap, 2000), args.seed
    )
    for arm, value in stability.items():
        summaries[arm]["frontier_stability"] = value
    frontier = point_frontier(summaries, config)

    comparisons: dict[str, Any] = {}
    for index, (arm, arm_rows) in enumerate(sorted(by_arm.items())):
        parent = next((row.parent_arm for row in arm_rows if row.parent_arm), "")
        if parent and parent in by_arm:
            comparison = paired_delta(arm_rows, by_arm[parent])
            comparison["cluster_bootstrap"] = paired_cluster_bootstrap(
                arm_rows,
                by_arm[parent],
                args.bootstrap,
                args.seed + index * 2017,
            )
            comparisons[f"{arm}_minus_{parent}"] = comparison

    args.output.mkdir(parents=True, exist_ok=True)
    write_csv(
        args.output / "arm_metrics.csv",
        [summaries[arm] for arm in sorted(summaries)],
    )
    dump_json(
        args.output / "pareto_result.json",
        {
            "schema": "h5-pareto-result-v2",
            "status": "RESEARCH_ONLY",
            "live_trading_allowed": False,
            "frontier": frontier,
            "summaries": summaries,
            "paired_comparisons": comparisons,
            "data_warnings": warnings,
            "bootstrap_draws": args.bootstrap,
            "frontier_stability_draws": min(args.bootstrap, 2000),
            "seed": args.seed,
        },
    )
    (args.output / "REPORT.md").write_text(
        render_report(summaries, frontier, comparisons, warnings),
        encoding="utf-8",
    )
    print(
        json.dumps(
            {"frontier": frontier, "arms": sorted(summaries), "warnings": len(warnings)}
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
