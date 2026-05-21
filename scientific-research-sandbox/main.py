import streamlit as st
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats
from pydantic_ai import Agent
from docling.document_converter import DocumentConverter
import os
import tempfile
import traceback
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Initialisation
# ---------------------------------------------------------------------------

@st.cache_resource
def get_docling_converter():
    return DocumentConverter()


def get_agent() -> Agent:
    return Agent(
        "openai:gpt-4o",
        system_prompt=(
            "You are a senior Scientific Data Scientist. "
            "Analyse data from messy documents (PDF, CSV, DOCX) and provide "
            "statistical insights. Always look for trends, anomalies, and "
            "statistical significance. When you reference numbers, cite the "
            "source column / table. Format your response in Markdown."
        ),
    )


# ---------------------------------------------------------------------------
# Helpers – file handling
# ---------------------------------------------------------------------------

def save_uploaded_file(uploaded_file) -> str:
    """Write an UploadedFile to a temp path and return the path."""
    suffix = os.path.splitext(uploaded_file.name)[1]
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(uploaded_file.getbuffer())
    tmp.close()
    return tmp.name


def parse_document(path: str) -> str:
    """Use Docling to convert PDF / DOCX to markdown text."""
    converter = get_docling_converter()
    result = converter.convert(path)
    return result.document.export_to_markdown()


def load_csv(path: str) -> pd.DataFrame:
    """Try common CSV dialects and return a DataFrame."""
    for sep in [",", ";", "\t", "|"]:
        try:
            df = pd.read_csv(path, sep=sep)
            if df.shape[1] > 1:
                return df
        except Exception:
            continue
    return pd.read_csv(path)


def ingest_file(uploaded_file):
    """Return (dataframe_or_None, markdown_text, filename)."""
    path = save_uploaded_file(uploaded_file)
    name = uploaded_file.name.lower()
    try:
        if name.endswith(".csv"):
            df = load_csv(path)
            return df, df.to_string(max_rows=200), uploaded_file.name
        else:
            text = parse_document(path)
            return None, text, uploaded_file.name
    except Exception as exc:
        st.error(f"Failed to process **{uploaded_file.name}**: {exc}")
        return None, None, uploaded_file.name
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


# ---------------------------------------------------------------------------
# Analysis helpers
# ---------------------------------------------------------------------------

def summary_statistics(df: pd.DataFrame) -> str:
    """Return a markdown string with descriptive stats."""
    lines = []
    lines.append("### Descriptive Statistics\n")
    lines.append(df.describe(include="all").to_markdown())
    lines.append("\n### Null Counts\n")
    nulls = df.isnull().sum()
    nulls = nulls[nulls > 0]
    if nulls.empty:
        lines.append("No missing values detected.")
    else:
        lines.append(nulls.to_markdown())
    lines.append(f"\n**Shape:** {df.shape[0]} rows x {df.shape[1]} columns")
    return "\n".join(lines)


def correlation_analysis(df: pd.DataFrame):
    """Return (fig, markdown) for numeric correlation matrix."""
    numeric = df.select_dtypes(include="number")
    if numeric.shape[1] < 2:
        return None, "Need at least two numeric columns for correlation analysis."
    corr = numeric.corr()
    fig, ax = plt.subplots(figsize=(8, 6))
    sns.heatmap(corr, annot=True, fmt=".2f", cmap="coolwarm", ax=ax)
    ax.set_title("Correlation Matrix")
    plt.tight_layout()
    md = "### Correlation Matrix\n" + corr.to_markdown()
    return fig, md


def run_ttest(df: pd.DataFrame, col_a: str, col_b: str) -> str:
    """Independent two-sample t-test between two numeric columns."""
    a = df[col_a].dropna()
    b = df[col_b].dropna()
    t_stat, p_val = stats.ttest_ind(a, b, equal_var=False)
    result = (
        f"### Two-Sample T-Test: {col_a} vs {col_b}\n\n"
        f"| Metric | Value |\n|---|---|\n"
        f"| t-statistic | {t_stat:.4f} |\n"
        f"| p-value | {p_val:.6f} |\n"
        f"| Mean {col_a} | {a.mean():.4f} |\n"
        f"| Mean {col_b} | {b.mean():.4f} |\n\n"
    )
    if p_val < 0.05:
        result += "**Result:** Statistically significant difference (p < 0.05)."
    else:
        result += "**Result:** No statistically significant difference (p >= 0.05)."
    return result


def run_chi_square(df: pd.DataFrame, col_a: str, col_b: str) -> str:
    """Chi-square test of independence between two categorical columns."""
    ct = pd.crosstab(df[col_a], df[col_b])
    chi2, p_val, dof, _ = stats.chi2_contingency(ct)
    result = (
        f"### Chi-Square Test: {col_a} vs {col_b}\n\n"
        f"| Metric | Value |\n|---|---|\n"
        f"| Chi-square | {chi2:.4f} |\n"
        f"| p-value | {p_val:.6f} |\n"
        f"| Degrees of freedom | {dof} |\n\n"
    )
    if p_val < 0.05:
        result += "**Result:** Significant association (p < 0.05)."
    else:
        result += "**Result:** No significant association (p >= 0.05)."
    return result


def auto_visualise(df: pd.DataFrame):
    """Generate a set of sensible charts for a DataFrame. Returns list of figures."""
    figs = []
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()

    # Histograms for up to 6 numeric columns
    if numeric_cols:
        n = min(len(numeric_cols), 6)
        fig, axes = plt.subplots(1, n, figsize=(4 * n, 4))
        if n == 1:
            axes = [axes]
        for ax, col in zip(axes, numeric_cols[:n]):
            df[col].dropna().hist(ax=ax, bins=30, edgecolor="black")
            ax.set_title(col)
        plt.suptitle("Distributions", y=1.02)
        plt.tight_layout()
        figs.append(("Distributions", fig))

    # Box plots for numeric by first categorical
    if numeric_cols and cat_cols:
        cat = cat_cols[0]
        if df[cat].nunique() <= 12:
            for col in numeric_cols[:3]:
                fig, ax = plt.subplots(figsize=(7, 4))
                sns.boxplot(data=df, x=cat, y=col, ax=ax)
                ax.set_title(f"{col} by {cat}")
                plt.xticks(rotation=45, ha="right")
                plt.tight_layout()
                figs.append((f"{col} by {cat}", fig))

    # Scatter matrix for first 4 numeric columns
    if len(numeric_cols) >= 2:
        subset = numeric_cols[:4]
        fig, axes = plt.subplots(len(subset), len(subset), figsize=(10, 10))
        for i, ci in enumerate(subset):
            for j, cj in enumerate(subset):
                ax = axes[i][j] if len(subset) > 1 else axes
                if i == j:
                    ax.hist(df[ci].dropna(), bins=20, edgecolor="black")
                else:
                    ax.scatter(df[cj], df[ci], alpha=0.4, s=10)
                if i == len(subset) - 1:
                    ax.set_xlabel(cj, fontsize=8)
                if j == 0:
                    ax.set_ylabel(ci, fontsize=8)
                ax.tick_params(labelsize=6)
        plt.suptitle("Pair Plot", y=1.01)
        plt.tight_layout()
        figs.append(("Pair Plot", fig))

    return figs


# ---------------------------------------------------------------------------
# Session state init
# ---------------------------------------------------------------------------

def init_session():
    defaults = {
        "dataframes": {},       # name -> DataFrame
        "documents": {},        # name -> markdown text
        "chat_history": [],     # list of {"role", "content"}
        "analysis_outputs": [], # list of (label, content_or_fig)
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v


# ---------------------------------------------------------------------------
# Main UI
# ---------------------------------------------------------------------------

def main():
    st.set_page_config(page_title="Scientific Research Sandbox", layout="wide")
    init_session()

    # ---- Sidebar -----------------------------------------------------------
    st.sidebar.title("Scientific Research Sandbox")

    api_key = st.sidebar.text_input("OpenAI API Key", type="password")
    if api_key:
        os.environ["OPENAI_API_KEY"] = api_key

    st.sidebar.markdown("---")
    st.sidebar.header("Upload Files")
    uploaded_files = st.sidebar.file_uploader(
        "PDF, CSV, or DOCX",
        type=["pdf", "csv", "docx"],
        accept_multiple_files=True,
    )

    # Process new uploads
    if uploaded_files:
        for uf in uploaded_files:
            if uf.name not in st.session_state.dataframes and uf.name not in st.session_state.documents:
                with st.spinner(f"Processing {uf.name}..."):
                    df, text, name = ingest_file(uf)
                    if df is not None:
                        st.session_state.dataframes[name] = df
                    if text is not None:
                        st.session_state.documents[name] = text

    # Show loaded assets
    df_names = list(st.session_state.dataframes.keys())
    doc_names = list(st.session_state.documents.keys())

    if df_names or doc_names:
        st.sidebar.markdown("---")
        st.sidebar.subheader("Loaded Assets")
        for n in df_names:
            st.sidebar.markdown(f"- **[CSV]** {n}")
        for n in doc_names:
            if n not in df_names:
                st.sidebar.markdown(f"- **[DOC]** {n}")

    # Analysis mode selector
    st.sidebar.markdown("---")
    st.sidebar.header("Analysis Mode")
    mode = st.sidebar.radio(
        "Choose an analysis",
        ["Summary Statistics", "Correlation Analysis", "Hypothesis Test",
         "Auto Visualisation", "Custom Query"],
        index=4,
    )

    # Dataset selector (for modes that need a dataframe)
    active_df_name = None
    active_df = None
    if df_names and mode in ["Summary Statistics", "Correlation Analysis",
                              "Hypothesis Test", "Auto Visualisation"]:
        active_df_name = st.sidebar.selectbox("Select dataset", df_names)
        active_df = st.session_state.dataframes[active_df_name]

    # ---- Main area ---------------------------------------------------------
    st.title("Scientific Research Sandbox")

    tab_analysis, tab_chat, tab_results = st.tabs(
        ["Analysis", "Chat with Agent", "Results Gallery"]
    )

    # ---- Tab: Analysis -----------------------------------------------------
    with tab_analysis:
        if mode == "Summary Statistics":
            if active_df is not None:
                st.markdown(summary_statistics(active_df))
                st.dataframe(active_df.head(100))
            else:
                st.info("Upload a CSV file to view summary statistics.")

        elif mode == "Correlation Analysis":
            if active_df is not None:
                fig, md = correlation_analysis(active_df)
                st.markdown(md)
                if fig:
                    st.pyplot(fig)
                    st.session_state.analysis_outputs.append(("Correlation Matrix", fig))
            else:
                st.info("Upload a CSV file for correlation analysis.")

        elif mode == "Hypothesis Test":
            if active_df is not None:
                numeric_cols = active_df.select_dtypes(include="number").columns.tolist()
                cat_cols = active_df.select_dtypes(include=["object", "category"]).columns.tolist()

                test_type = st.radio("Test type", ["T-Test (numeric)", "Chi-Square (categorical)"])

                if test_type == "T-Test (numeric)" and len(numeric_cols) >= 2:
                    col_a = st.selectbox("Column A", numeric_cols, key="tt_a")
                    col_b = st.selectbox("Column B",
                                         [c for c in numeric_cols if c != col_a],
                                         key="tt_b")
                    if st.button("Run T-Test"):
                        result = run_ttest(active_df, col_a, col_b)
                        st.markdown(result)
                        st.session_state.analysis_outputs.append(("T-Test", result))
                elif test_type == "Chi-Square (categorical)" and len(cat_cols) >= 2:
                    col_a = st.selectbox("Column A", cat_cols, key="chi_a")
                    col_b = st.selectbox("Column B",
                                         [c for c in cat_cols if c != col_a],
                                         key="chi_b")
                    if st.button("Run Chi-Square Test"):
                        try:
                            result = run_chi_square(active_df, col_a, col_b)
                            st.markdown(result)
                            st.session_state.analysis_outputs.append(("Chi-Square", result))
                        except Exception as exc:
                            st.error(f"Chi-square test failed: {exc}")
                else:
                    st.warning("Not enough columns of the required type for the selected test.")
            else:
                st.info("Upload a CSV file to run hypothesis tests.")

        elif mode == "Auto Visualisation":
            if active_df is not None:
                figs = auto_visualise(active_df)
                if not figs:
                    st.info("No suitable columns found for automatic charts.")
                for label, fig in figs:
                    st.subheader(label)
                    st.pyplot(fig)
                    st.session_state.analysis_outputs.append((label, fig))
            else:
                st.info("Upload a CSV file to generate visualisations.")

        elif mode == "Custom Query":
            # Show previews of all loaded data
            if st.session_state.dataframes:
                st.subheader("Loaded DataFrames")
                for name, df in st.session_state.dataframes.items():
                    with st.expander(f"{name}  ({df.shape[0]} rows x {df.shape[1]} cols)"):
                        st.dataframe(df.head(50))
            if st.session_state.documents:
                st.subheader("Loaded Documents")
                for name, text in st.session_state.documents.items():
                    if name not in st.session_state.dataframes:
                        with st.expander(name):
                            st.markdown(text[:3000])

    # ---- Tab: Chat with Agent -----------------------------------------------
    with tab_chat:
        # Render conversation history
        for msg in st.session_state.chat_history:
            with st.chat_message(msg["role"]):
                st.markdown(msg["content"])

        user_input = st.chat_input("Ask a question about your data...")

        if user_input:
            st.session_state.chat_history.append({"role": "user", "content": user_input})
            with st.chat_message("user"):
                st.markdown(user_input)

            if not os.environ.get("OPENAI_API_KEY"):
                assistant_msg = "Please provide an OpenAI API key in the sidebar."
            else:
                # Build context from all loaded data
                context_parts = []
                for name, df in st.session_state.dataframes.items():
                    context_parts.append(
                        f"## Dataset: {name}\n"
                        f"Shape: {df.shape}\n"
                        f"Columns: {list(df.columns)}\n"
                        f"Describe:\n{df.describe(include='all').to_string()}\n"
                        f"Sample rows:\n{df.head(10).to_string()}\n"
                    )
                for name, text in st.session_state.documents.items():
                    if name not in st.session_state.dataframes:
                        context_parts.append(
                            f"## Document: {name}\n{text[:4000]}\n"
                        )

                context_block = "\n---\n".join(context_parts) if context_parts else "No data loaded."

                prompt = (
                    f"Context (uploaded research data):\n{context_block}\n\n"
                    f"User question: {user_input}"
                )

                with st.chat_message("assistant"):
                    with st.spinner("Analysing..."):
                        try:
                            agent = get_agent()
                            result = agent.run_sync(prompt)
                            assistant_msg = result.data
                        except Exception as exc:
                            assistant_msg = f"Agent error: {exc}"
                    st.markdown(assistant_msg)

            st.session_state.chat_history.append({"role": "assistant", "content": assistant_msg})

    # ---- Tab: Results Gallery -----------------------------------------------
    with tab_results:
        if not st.session_state.analysis_outputs:
            st.info("Run an analysis to see results here.")
        for i, (label, item) in enumerate(st.session_state.analysis_outputs):
            st.subheader(f"{i + 1}. {label}")
            if isinstance(item, plt.Figure):
                st.pyplot(item)
            else:
                st.markdown(item)

        if st.session_state.analysis_outputs:
            if st.button("Clear Results"):
                st.session_state.analysis_outputs = []
                st.rerun()


if __name__ == "__main__":
    main()
