"""
Query Review Page — Live query tester for internal analysts.
Connects to the local FastAPI service and streams responses.
"""

from __future__ import annotations

import json
import os
import httpx
import streamlit as st


API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000")


def render() -> None:
    st.header("🔍 Live Query Tester")
    st.caption("Test procurement queries against the multi-agent system")

    # Auth
    with st.expander("🔐 Authentication", expanded=not st.session_state.get("token")):
        col1, col2, col3 = st.columns(3)
        with col1:
            username = st.text_input("Username", value="analyst")
        with col2:
            password = st.text_input("Password", type="password", value="analyst123")
        with col3:
            st.write("")
            st.write("")
            if st.button("Login", type="primary"):
                try:
                    resp = httpx.post(
                        f"{API_BASE}/auth/token",
                        data={"username": username, "password": password},
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        st.session_state["token"] = data["access_token"]
                        st.session_state["tier"] = data["tier"]
                        st.success(f"✅ Logged in as {username} ({data['tier']} tier)")
                    else:
                        st.error("Invalid credentials")
                except Exception as e:
                    st.error(f"Connection error: {e}")

    if not st.session_state.get("token"):
        st.warning("Please log in to test queries")
        return

    st.info(f"🎫 Active tier: **{st.session_state.get('tier', 'PUBLIC')}**")

    # Query input
    query = st.text_area(
        "Procurement Query",
        placeholder="e.g. Which vendors have overdue invoices above $50,000 this quarter?",
        height=100,
    )

    example_queries = [
        "What is our total spend by vendor this fiscal year?",
        "Which contracts expire in the next 90 days?",
        "Show me high-risk vendors with active purchase orders",
        "What is the average payment cycle by department?",
    ]

    st.caption("📌 Example queries:")
    cols = st.columns(2)
    for i, example in enumerate(example_queries):
        if cols[i % 2].button(example[:50] + "...", key=f"example_{i}"):
            query = example

    if st.button("🚀 Run Query", type="primary", disabled=not query):
        headers = {"Authorization": f"Bearer {st.session_state['token']}"}

        with st.status("🤖 Agent processing...", expanded=True) as status:
            events_container = st.empty()
            all_events = []

            try:
                with httpx.stream(
                    "POST",
                    f"{API_BASE}/api/v1/query",
                    json={"query": query, "stream": True},
                    headers=headers,
                    timeout=120,
                ) as response:
                    for line in response.iter_lines():
                        if line.startswith("data:"):
                            data = json.loads(line[5:].strip())
                            all_events.append(data)
                            # Live update
                            event_text = "\n".join([
                                f"• **{e.get('message', e.get('event', ''))}**"
                                for e in all_events
                            ])
                            events_container.markdown(event_text)

                status.update(label="✅ Complete", state="complete")

            except Exception as e:
                status.update(label="❌ Error", state="error")
                st.error(f"Error: {e}")

        # Display final answer
        final = next((e for e in all_events if "answer" in e), None)
        if final:
            st.divider()
            st.subheader("📋 Answer")
            st.markdown(final.get("answer", ""))

            col1, col2 = st.columns(2)
            with col1:
                st.metric("Confidence", f"{final.get('confidence_score', 0):.0%}")
            with col2:
                st.metric("Processing Time", f"{final.get('processing_time_ms', 0)}ms")

            if final.get("sql_query"):
                with st.expander("🗄️ Generated SQL"):
                    st.code(final["sql_query"], language="sql")

            if final.get("citations"):
                with st.expander(f"📚 Citations ({len(final['citations'])})"):
                    for c in final["citations"]:
                        st.markdown(f"**{c.get('source')}**: {c.get('excerpt', '')[:200]}")
