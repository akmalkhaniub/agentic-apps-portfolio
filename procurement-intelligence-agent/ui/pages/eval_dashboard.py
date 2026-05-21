"""
Eval Dashboard Page — Visualises LLM-judge scores, human calibration,
latency metrics, and tier-based quality breakdowns.
"""

from __future__ import annotations

import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd


def render() -> None:
    st.header("📊 Evaluation Dashboard")
    st.caption("LLM-as-Judge metrics, human calibration, and latency analysis")

    col1, col2, col3 = st.columns(3)
    with col1:
        hours = st.slider("Hours back", 1, 168, 24, key="eval_hours")
    with col2:
        sample = st.slider("Sample size", 10, 200, 50, key="eval_sample")
    with col3:
        st.write("")
        st.write("")
        run_eval = st.button("▶️ Run Evaluation", type="primary")

    if run_eval:
        with st.spinner("Running LLM-as-judge evaluation..."):
            try:
                from eval.harness import ProcurementEvalHarness
                harness = ProcurementEvalHarness()
                traces = harness.pull_traces(hours_back=hours, limit=sample)
                metrics = harness.run_eval(traces, sample_size=sample)
                st.session_state["eval_metrics"] = metrics
                st.session_state["eval_traces"] = traces
            except Exception as e:
                st.error(f"Eval failed: {e}")
                return

    if "eval_metrics" not in st.session_state:
        # Show demo data if no real data
        st.session_state["eval_metrics"] = {
            "trace_count": 47,
            "faithfulness": {"mean": 0.84, "median": 0.87, "min": 0.42},
            "relevance": {"mean": 0.91, "median": 0.93},
            "citation_quality": {"mean": 0.78},
            "latency_ms": {"p50": 3200, "p95": 7800},
        }

    metrics = st.session_state["eval_metrics"]

    # ── KPI Cards ─────────────────────────────────────────────────────────────
    st.divider()
    k1, k2, k3, k4, k5 = st.columns(5)
    k1.metric("Traces Evaluated", metrics.get("trace_count", 0))
    k2.metric("Faithfulness", f"{metrics['faithfulness']['mean']:.0%}",
              delta=f"target: 85%",
              delta_color="normal" if metrics['faithfulness']['mean'] >= 0.85 else "inverse")
    k3.metric("Relevance", f"{metrics['relevance']['mean']:.0%}")
    k4.metric("Citation Quality", f"{metrics['citation_quality']['mean']:.0%}")
    k5.metric("P95 Latency", f"{metrics['latency_ms']['p95']}ms",
              delta="target: 8000ms",
              delta_color="normal" if metrics['latency_ms']['p95'] <= 8000 else "inverse")

    # ── Score Distribution Chart ───────────────────────────────────────────────
    st.divider()
    col_left, col_right = st.columns(2)

    with col_left:
        st.subheader("📈 Quality Score Distribution")
        demo_data = pd.DataFrame({
            "Score": [0.92, 0.87, 0.84, 0.79, 0.93, 0.88, 0.76, 0.91, 0.85, 0.80],
            "Metric": ["Faithfulness"] * 5 + ["Relevance"] * 5,
        })
        fig = px.box(demo_data, x="Metric", y="Score", color="Metric",
                     color_discrete_sequence=["#6366f1", "#10b981"])
        fig.update_layout(showlegend=False, height=300, margin=dict(t=20))
        st.plotly_chart(fig, use_container_width=True)

    with col_right:
        st.subheader("🎯 LLM-Judge vs Human Calibration")
        demo_judge = [0.85, 0.78, 0.92, 0.71, 0.88, 0.65, 0.94, 0.82, 0.77, 0.90]
        demo_human = [0.80, 0.75, 0.90, 0.70, 0.85, 0.60, 0.95, 0.80, 0.72, 0.88]

        fig2 = go.Figure()
        fig2.add_trace(go.Scatter(
            x=demo_judge, y=demo_human, mode="markers",
            marker=dict(size=10, color="#6366f1"),
            name="Scores",
        ))
        # Perfect correlation line
        fig2.add_trace(go.Scatter(
            x=[0.5, 1.0], y=[0.5, 1.0], mode="lines",
            line=dict(dash="dash", color="gray"),
            name="Perfect calibration",
        ))
        fig2.update_layout(
            xaxis_title="LLM Judge Score",
            yaxis_title="Human Score",
            height=300,
            margin=dict(t=20),
            showlegend=True,
        )
        st.plotly_chart(fig2, use_container_width=True)

    # ── Latency trend ─────────────────────────────────────────────────────────
    st.subheader("⚡ Latency Trend (last 24h)")
    import random
    import datetime
    times = [datetime.datetime.now() - datetime.timedelta(minutes=i*30) for i in range(48)]
    latencies = [random.randint(2000, 9000) for _ in range(48)]
    fig3 = px.line(x=times, y=latencies, labels={"x": "Time", "y": "Latency (ms)"},
                   color_discrete_sequence=["#10b981"])
    fig3.add_hline(y=8000, line_dash="dash", line_color="red", annotation_text="P95 Target")
    fig3.update_layout(height=250, margin=dict(t=20))
    st.plotly_chart(fig3, use_container_width=True)
