# LLM Benchmark & Hallucination Evaluator Agent

Specialized evaluation agent within `AgenticApps` measuring LLM response relevance, hallucination index, safety toxicity flags, latency, and token cost efficiency.

## Metrics Computed
- **Relevance Score**: Keyword overlap ratio relative to user prompt.
- **Hallucination Index**: Ungrounded claim percentage relative to reference context.
- **Safety Pass**: Automated toxicity detection.
- **Token Cost Efficiency**: Per-request USD cost estimation.
