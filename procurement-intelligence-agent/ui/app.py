"""
Streamlit App — Internal annotation and eval dashboard.
Pages:
  1. Query Review — annotate LangSmith traces with human scores
  2. Eval Dashboard — visualise LLM-judge vs human calibration metrics
"""

from __future__ import annotations

import streamlit as st

st.set_page_config(
    page_title="Procurement Intelligence — Internal Dashboard",
    page_icon="🏛️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Sidebar ────────────────────────────────────────────────────────────────────
with st.sidebar:
    st.image("https://img.icons8.com/fluency/96/artificial-intelligence.png", width=60)
    st.title("Procurement AI")
    st.caption("Internal Evaluation & Annotation Dashboard")
    st.divider()
    page = st.radio(
        "Navigation",
        ["🔍 Query Tester", "📝 Trace Annotation", "📊 Eval Dashboard"],
        label_visibility="collapsed",
    )

# ── Page routing ───────────────────────────────────────────────────────────────

if page == "🔍 Query Tester":
    from ui.pages import query_review
    query_review.render()

elif page == "📝 Trace Annotation":
    st.header("📝 Trace Annotation")
    st.info("Pull LangSmith traces and annotate with human quality scores (1–5)")

    col1, col2 = st.columns([2, 1])
    with col2:
        hours = st.slider("Hours back", 1, 72, 24)
        sample = st.slider("Sample size", 5, 50, 10)
        tier_filter = st.selectbox("Tier filter", ["All", "INTERNAL", "PARTNER", "PUBLIC"])

    if st.button("🔄 Pull Traces", type="primary"):
        try:
            from eval.harness import ProcurementEvalHarness
            harness = ProcurementEvalHarness()
            tf = None if tier_filter == "All" else tier_filter
            traces = harness.pull_traces(hours_back=hours, limit=sample, filter_tier=tf)
            st.session_state["traces"] = traces
            st.success(f"Pulled {len(traces)} traces")
        except Exception as e:
            st.error(f"Error: {e}")

    if "traces" in st.session_state:
        for i, trace in enumerate(st.session_state["traces"]):
            with st.expander(f"Trace {i+1}: {trace['query'][:80]}..."):
                st.markdown(f"**Answer:** {trace['answer'][:500]}")
                if trace.get("sql_query"):
                    st.code(trace["sql_query"], language="sql")
                st.slider(f"Faithfulness score (trace {i})", 1, 5, 3, key=f"faith_{i}")
                st.slider(f"Relevance score (trace {i})", 1, 5, 3, key=f"rel_{i}")

elif page == "📊 Eval Dashboard":
    from ui.pages import eval_dashboard
    eval_dashboard.render()
