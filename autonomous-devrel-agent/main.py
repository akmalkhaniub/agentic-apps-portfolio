from __future__ import annotations

import os
import uuid
from datetime import datetime
from typing import Any

import discord
from discord.ext import commands
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from haystack import Pipeline
from haystack.components.builders import PromptBuilder
from haystack.components.embedders import OpenAIDocumentEmbedder, OpenAITextEmbedder
from haystack.components.generators import OpenAIGenerator
from haystack.components.retrievers.in_memory import InMemoryEmbeddingRetriever
from haystack.dataclasses import Document
from haystack.document_stores.in_memory import InMemoryDocumentStore
from pydantic import BaseModel, Field

load_dotenv()

app = FastAPI(title="Autonomous DevRel Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

document_store = InMemoryDocumentStore()

SEED_DOCS = [
    Document(content="Our API uses Bearer tokens for authentication.", meta={"source": "docs", "topic": "auth"}),
    Document(content="The /v1/chat endpoint supports streaming responses.", meta={"source": "docs", "topic": "api"}),
    Document(content="Rate limits are 100 requests per minute for the free tier.", meta={"source": "docs", "topic": "limits"}),
]

doc_embedder = OpenAIDocumentEmbedder()

try:
    embedded_docs = doc_embedder.run(documents=SEED_DOCS)
    document_store.write_documents(embedded_docs["documents"])
except Exception:
    document_store.write_documents(SEED_DOCS)


RAG_TEMPLATE = """Answer the following question based on the provided context.
If the answer is not in the context, say "I don't have information about that in my knowledge base."

Context:
{% for doc in documents %}
  {{ doc.content }}
{% endfor %}

Question: {{ question }}
Answer:"""

DRAFT_TEMPLATE = """You are a developer relations expert. Draft a helpful community response
to the following question. Use the provided context documents to ensure accuracy.
Be friendly, concise, and include code examples where relevant.

Context:
{% for doc in documents %}
  {{ doc.content }}
{% endfor %}

Question: {{ question }}
Draft response:"""


def build_rag_pipeline() -> Pipeline:
    pipeline = Pipeline()
    pipeline.add_component("embedder", OpenAITextEmbedder())
    pipeline.add_component("retriever", InMemoryEmbeddingRetriever(document_store=document_store))
    pipeline.add_component("prompt_builder", PromptBuilder(template=RAG_TEMPLATE))
    pipeline.add_component("llm", OpenAIGenerator(model="gpt-4o"))
    pipeline.connect("embedder.embedding", "retriever.query_embedding")
    pipeline.connect("retriever", "prompt_builder.documents")
    pipeline.connect("prompt_builder", "llm")
    return pipeline


def build_draft_pipeline() -> Pipeline:
    pipeline = Pipeline()
    pipeline.add_component("embedder", OpenAITextEmbedder())
    pipeline.add_component("retriever", InMemoryEmbeddingRetriever(document_store=document_store))
    pipeline.add_component("prompt_builder", PromptBuilder(template=DRAFT_TEMPLATE))
    pipeline.add_component("llm", OpenAIGenerator(model="gpt-4o"))
    pipeline.connect("embedder.embedding", "retriever.query_embedding")
    pipeline.connect("retriever", "prompt_builder.documents")
    pipeline.connect("prompt_builder", "llm")
    return pipeline


rag_pipeline = build_rag_pipeline()
draft_pipeline = build_draft_pipeline()


# --- Pydantic models ---

class IngestRequest(BaseModel):
    content: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class QueryRequest(BaseModel):
    question: str


class DraftRequest(BaseModel):
    question: str


class QueryResponse(BaseModel):
    answer: str
    sources: list[dict[str, Any]] = Field(default_factory=list)


class DraftResponse(BaseModel):
    id: str = Field(default_factory=lambda: f"draft_{uuid.uuid4().hex[:8]}")
    question: str
    draft: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


def run_rag_query(question: str) -> dict[str, Any]:
    try:
        result = rag_pipeline.run({
            "embedder": {"text": question},
            "prompt_builder": {"question": question},
        })
        answer = result["llm"]["replies"][0]
        docs = result.get("retriever", {}).get("documents", [])
        sources = [{"content": d.content[:200], "meta": d.meta} for d in docs]
        return {"answer": answer, "sources": sources}
    except Exception as e:
        return {"answer": f"Error processing query: {e}", "sources": []}


# --- FastAPI endpoints ---

@app.post("/docs/ingest")
async def ingest_document(req: IngestRequest):
    doc = Document(content=req.content, meta=req.metadata)
    try:
        embedded = doc_embedder.run(documents=[doc])
        document_store.write_documents(embedded["documents"])
    except Exception:
        document_store.write_documents([doc])
    count = document_store.count_documents()
    return {"status": "ingested", "total_documents": count}


@app.post("/query", response_model=QueryResponse)
async def query(req: QueryRequest):
    result = run_rag_query(req.question)
    return QueryResponse(answer=result["answer"], sources=result["sources"])


@app.post("/drafts", response_model=DraftResponse)
async def create_draft(req: DraftRequest):
    try:
        result = draft_pipeline.run({
            "embedder": {"text": req.question},
            "prompt_builder": {"question": req.question},
        })
        draft_text = result["llm"]["replies"][0]
    except Exception as e:
        draft_text = f"Unable to generate draft: {e}"

    return DraftResponse(question=req.question, draft=draft_text)


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "documents": document_store.count_documents(),
        "pipelines": ["rag", "draft"],
    }


@app.get("/docs/stats")
async def docs_stats():
    count = document_store.count_documents()
    return {
        "total_documents": count,
        "store_type": "InMemoryDocumentStore",
    }


# --- Discord bot ---

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)


@bot.event
async def on_ready():
    print(f"DevRel Agent is online as {bot.user}")


@bot.command()
async def ask(ctx, *, question):
    print(f"Question from {ctx.author}: {question}")
    try:
        result = run_rag_query(question)
        await ctx.send(result["answer"])
    except Exception as e:
        await ctx.send(f"Error: {e}")


if __name__ == "__main__":
    import threading

    import uvicorn

    discord_token = os.getenv("DISCORD_TOKEN")
    if discord_token:
        threading.Thread(
            target=lambda: bot.run(discord_token),
            daemon=True,
        ).start()
        print("Discord bot started in background thread.")

    uvicorn.run(app, host="0.0.0.0", port=8000)
