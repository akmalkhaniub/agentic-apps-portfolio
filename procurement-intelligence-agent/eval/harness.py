"""
LangSmith Eval Harness — Extracts production traces, runs LLM-as-judge
evaluation, and calibrates against human ratings.
"""

from __future__ import annotations

import json
import math
import os
import statistics
from datetime import datetime, timedelta, timezone
from typing import Any

import structlog
from langsmith import Client

from eval.judge import ProcurementJudge

logger = structlog.get_logger(__name__)


class ProcurementEvalHarness:
    """
    Evaluation harness for the Procurement Intelligence Agent.

    Workflow:
    1. Pull recent production traces from LangSmith
    2. Run LLM-as-judge on each trace
    3. (Optional) Compare against human ratings
    4. Report metrics: faithfulness, relevance, SQL accuracy
    """

    def __init__(self) -> None:
        self._client = Client(api_key=os.environ["LANGCHAIN_API_KEY"])
        self._judge = ProcurementJudge()
        self._project = os.environ.get("LANGCHAIN_PROJECT", "procurement-intelligence-agent")

    def pull_traces(
        self,
        hours_back: int = 24,
        limit: int = 100,
        filter_tier: str | None = None,
    ) -> list[dict[str, Any]]:
        """Pull recent production traces from LangSmith."""
        start_time = datetime.now(timezone.utc) - timedelta(hours=hours_back)

        runs = list(self._client.list_runs(
            project_name=self._project,
            start_time=start_time,
            limit=limit,
            run_type="chain",
            filter=f'eq(tags, "{filter_tier.lower()}")' if filter_tier else None,
        ))

        logger.info("harness.traces_pulled", count=len(runs))
        return [self._run_to_dict(r) for r in runs]

    def _run_to_dict(self, run) -> dict[str, Any]:
        return {
            "run_id": str(run.id),
            "query": (run.inputs or {}).get("original_query", ""),
            "answer": (run.outputs or {}).get("final_answer", ""),
            "citations": (run.outputs or {}).get("citations", []),
            "sql_query": (run.outputs or {}).get("sql_query", ""),
            "confidence_score": (run.outputs or {}).get("confidence_score", 0.0),
            "latency_ms": run.latency_s * 1000 if run.latency_s else 0,
            "tags": run.tags or [],
        }

    def run_eval(
        self,
        traces: list[dict[str, Any]],
        sample_size: int | None = None,
    ) -> dict[str, Any]:
        """
        Run LLM-as-judge evaluation on a set of traces.

        Returns:
            Aggregated metrics dict.
        """
        if sample_size and len(traces) > sample_size:
            import random
            traces = random.sample(traces, sample_size)

        results = []
        for trace in traces:
            if not trace["query"] or not trace["answer"]:
                continue

            scores = self._judge.evaluate(
                query=trace["query"],
                answer=trace["answer"],
                citations=trace["citations"],
                sql_query=trace.get("sql_query"),
            )
            results.append({**trace, "judge_scores": scores})

        if not results:
            return {"error": "No evaluable traces found"}

        # Aggregate metrics
        faithfulness_scores = [r["judge_scores"]["faithfulness"] for r in results]
        relevance_scores = [r["judge_scores"]["relevance"] for r in results]
        citation_scores = [r["judge_scores"]["citation_quality"] for r in results]
        latencies = [r["latency_ms"] for r in results]

        p95_idx = min(int(len(latencies) * 0.95), len(latencies) - 1)

        metrics = {
            "eval_timestamp": datetime.now(timezone.utc).isoformat(),
            "trace_count": len(results),
            "faithfulness": {
                "mean": round(statistics.mean(faithfulness_scores), 3),
                "median": round(statistics.median(faithfulness_scores), 3),
                "min": round(min(faithfulness_scores), 3),
            },
            "relevance": {
                "mean": round(statistics.mean(relevance_scores), 3),
                "median": round(statistics.median(relevance_scores), 3),
            },
            "citation_quality": {
                "mean": round(statistics.mean(citation_scores), 3),
            },
            "latency_ms": {
                "p50": round(statistics.median(latencies)),
                "p95": round(sorted(latencies)[p95_idx]),
            },
        }

        logger.info("harness.eval_complete", metrics=metrics)
        return metrics

    def calibrate_against_human(
        self,
        judge_scores: list[float],
        human_scores: list[float],
    ) -> dict[str, float]:
        """
        Calculate Pearson correlation between LLM judge and human ratings.

        FIX #21: Correct Pearson formula using proper covariance / (stdev_x * stdev_y).
        """
        if len(judge_scores) != len(human_scores):
            raise ValueError("Score lists must be the same length")

        n = len(judge_scores)
        if n < 3:
            raise ValueError("Need at least 3 samples for meaningful correlation")

        mean_j = statistics.mean(judge_scores)
        mean_h = statistics.mean(human_scores)
        stdev_j = statistics.stdev(judge_scores)
        stdev_h = statistics.stdev(human_scores)

        if stdev_j == 0 or stdev_h == 0:
            correlation = 0.0
        else:
            # Pearson r = Σ((x - mean_x)(y - mean_y)) / ((n-1) * stdev_x * stdev_y)
            covariance = sum(
                (j - mean_j) * (h - mean_h) for j, h in zip(judge_scores, human_scores)
            ) / (n - 1)
            correlation = covariance / (stdev_j * stdev_h)

        result = {
            "pearson_correlation": round(correlation, 4),
            "judge_mean": round(mean_j, 3),
            "human_mean": round(mean_h, 3),
            "sample_size": n,
        }

        logger.info("harness.calibration", **result)
        return result


if __name__ == "__main__":
    harness = ProcurementEvalHarness()
    traces = harness.pull_traces(hours_back=24, limit=50)
    metrics = harness.run_eval(traces, sample_size=20)
    print(json.dumps(metrics, indent=2))
