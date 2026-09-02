from __future__ import annotations

import csv
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("h5_pareto_lab.py")
SPEC = importlib.util.spec_from_file_location("h5_pareto_lab", MODULE_PATH)
assert SPEC and SPEC.loader
lab = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = lab
SPEC.loader.exec_module(lab)


class ParetoLabTests(unittest.TestCase):
    def test_max_drawdown(self) -> None:
        self.assertAlmostEqual(lab.max_drawdown([1.0, -0.5, -1.0, 0.2]), 1.5)

    def test_cvar_loss(self) -> None:
        self.assertAlmostEqual(lab.cvar_loss([-2.0, -1.0, 1.0, 2.0], 0.25), 2.0)

    def test_profit_factor(self) -> None:
        self.assertAlmostEqual(lab.profit_factor([2.0, -1.0, 1.0, -1.0]), 1.5)

    def test_epsilon_dominance(self) -> None:
        directions = {"return": "max", "drawdown": "min"}
        epsilon = {"return": 0.05, "drawdown": 0.10}
        left = {"return": 0.30, "drawdown": 1.00}
        right = {"return": 0.20, "drawdown": 1.05}
        self.assertTrue(lab.epsilon_dominates(left, right, directions, epsilon))
        self.assertFalse(lab.epsilon_dominates(right, left, directions, epsilon))

    def test_paired_delta_exact_support(self) -> None:
        def row(arm: str, cycle: str, candidate: str, reward: float):
            return lab.Row(
                raw={}, source_cycle_id=cycle, candidate_id=candidate, arm_id=arm,
                decision_ts=None, terminal_ts=None, accepted=reward != 0,
                matured=True, net_r=reward if reward != 0 else None,
                stress15_r=None, stress20_r=None, initial_stop_risk=1.0,
                policy_reward_r=reward, regime="R", symbol="S",
                correlation_cluster="K", parent_arm="",
            )
        a = [row("A", "1", "x", 1.0), row("A", "2", "y", -0.5)]
        b = [row("B", "1", "x", 0.0), row("B", "2", "y", -1.0)]
        result = lab.paired_delta(a, b)
        self.assertEqual(result["common_n"], 2)
        self.assertAlmostEqual(result["mean_delta_r"], 0.75)

    def test_loader_rejects_duplicate_key(self) -> None:
        columns = sorted(lab.REQUIRED | {"policy_reward_r"})
        template = {
            "source_cycle_id": "c1",
            "candidate_id": "x",
            "arm_id": "A",
            "decision_ts": "2026-09-02T00:00:00+00:00",
            "terminal_ts": "2026-09-02T01:00:00+00:00",
            "accepted": "true",
            "matured": "true",
            "net_r": "1.0",
            "initial_stop_risk": "1.0",
            "feature_hash": "f",
            "policy_hash": "p",
            "cost_hash": "c",
            "execution_hash": "e",
            "universe_hash": "u",
            "policy_reward_r": "1.0",
        }
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "x.csv"
            with path.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=columns)
                writer.writeheader()
                writer.writerow(template)
                writer.writerow(template)
            rows, errors = lab.load_rows(path)
            self.assertEqual(len(rows), 1)
            self.assertTrue(any("duplicate" in error for error in errors))

    def test_unresolved_is_bounded_not_zero_filled(self) -> None:
        config = {
            "missing_outcomes": {"optimistic_bound_r": 3.0, "pessimistic_bound_r": -1.5},
            "feasibility": {
                "terminal_maturity_min": 0.0,
                "common_support_research_min": 0.0,
                "hash_drift_max": 99,
            },
        }
        base = dict(
            raw={name: "h" for name in lab.HASH_COLUMNS}, source_cycle_id="1",
            candidate_id="x", arm_id="A", decision_ts=None, terminal_ts=None,
            stress15_r=None, stress20_r=None, initial_stop_risk=1.0,
            regime="R", symbol="S", correlation_cluster="K", parent_arm="",
        )
        resolved = lab.Row(**base, accepted=True, matured=True, net_r=1.0, policy_reward_r=1.0)
        unresolved = lab.Row(**{**base, "candidate_id": "y"}, accepted=True, matured=False, net_r=None, policy_reward_r=0.0)
        result = lab.summarize_arm([resolved, unresolved], {("1", "x"), ("1", "y")}, config)
        self.assertAlmostEqual(result["expectancy_optimistic_bound_r"], 2.0)
        self.assertAlmostEqual(result["expectancy_pessimistic_bound_r"], -0.25)

    def test_point_frontier(self) -> None:
        config = {
            "objective_directions": {"return": "max", "drawdown": "min"},
            "epsilon": {"return": 0.01, "drawdown": 0.01},
        }
        summaries = {
            "A": {"feasible": True, "return": 1.0, "drawdown": 1.0},
            "B": {"feasible": True, "return": 0.5, "drawdown": 2.0},
            "C": {"feasible": False, "return": 2.0, "drawdown": 0.5},
        }
        self.assertEqual(lab.point_frontier(summaries, config), ["A"])

    def test_config_json_contract(self) -> None:
        config = {
            "missing_outcomes": {"optimistic_bound_r": 3.0, "pessimistic_bound_r": -1.5},
            "feasibility": {
                "terminal_maturity_min": 0.95,
                "common_support_research_min": 0.95,
                "hash_drift_max": 0,
            },
            "objective_directions": {"expectancy_lcb95_r": "max", "max_drawdown_r": "min"},
            "epsilon": {"expectancy_lcb95_r": 0.01, "max_drawdown_r": 0.01},
        }
        with tempfile.TemporaryDirectory() as tmp:
            cfg = Path(tmp) / "cfg.json"
            cfg.write_text(json.dumps(config), encoding="utf-8")
            self.assertIn("objective_directions", json.loads(cfg.read_text(encoding="utf-8")))


if __name__ == "__main__":
    unittest.main()
