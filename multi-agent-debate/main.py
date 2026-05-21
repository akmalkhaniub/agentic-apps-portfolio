import asyncio
import uuid
import time
from typing import Any, List
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Multi-Agent Debate Environment")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DebateRequest(BaseModel):
    topic: str

class TraceEvent(BaseModel):
    id: str
    source: str
    type: str # 'log', 'argument', 'critique', 'synthesis'
    content: Any
    timestamp: float
    target: str = "" # useful for drawing edges in DAG (e.g. source=Alpha, target=Beta)

class DebateResponse(BaseModel):
    job_id: str
    status: str
    summary: str
    traces: List[TraceEvent]

def create_trace(source: str, type_: str, content: Any, target: str = "") -> TraceEvent:
    return TraceEvent(
        id=str(uuid.uuid4())[:8],
        source=source,
        type=type_,
        content=content,
        timestamp=time.time(),
        target=target
    )

@app.post("/debate", response_model=DebateResponse)
async def start_debate(req: DebateRequest):
    traces = []
    job_id = str(uuid.uuid4())
    
    # User Input to Moderator
    traces.append(create_trace("User", "log", f"Proposed debate topic: '{req.topic}'", "Moderator"))
    await asyncio.sleep(0.5)

    # Moderator routes to Alpha and Beta
    traces.append(create_trace("Moderator", "log", "Initializing debate. Delegating to Proponent (Alpha) and Opponent (Beta).", "AgentAlpha"))
    traces.append(create_trace("Moderator", "log", "Delegating to Opponent.", "AgentBeta"))
    await asyncio.sleep(1.0)
    
    # Agent Alpha (Proponent)
    alpha_arg = f"I strongly support the premise that {req.topic}. The primary benefits include scalability, rapid iteration, and reduced overhead costs. It is the logical progression of our industry."
    traces.append(create_trace("AgentAlpha", "argument", alpha_arg, "AgentBeta"))
    await asyncio.sleep(1.5)

    # Agent Beta (Opponent)
    beta_critique = f"While Alpha highlights scalability, they ignore the glaring security risks and vendor lock-in associated with {req.topic}. The total cost of ownership over a 5-year period often eclipses initial savings."
    traces.append(create_trace("AgentBeta", "critique", beta_critique, "Moderator"))
    await asyncio.sleep(1.5)

    # Moderator (Gamma) synthesizes
    traces.append(create_trace("Moderator", "log", "Receiving arguments and critiques. Generating synthesis..."))
    await asyncio.sleep(1.0)
    
    summary = (
        f"**Debate Conclusion on: {req.topic}**\n\n"
        f"**Proponent (Alpha):** Argued for scalability and reduced overhead.\n"
        f"**Opponent (Beta):** Rebutted with concerns over security risks and long-term vendor lock-in.\n"
        f"**Synthesis:** Both agents raise valid points. A hybrid approach is recommended: "
        f"leverage the scalability of {req.topic} for stateless workloads, but maintain on-premise controls for secure, stateful data."
    )
    traces.append(create_trace("Moderator", "synthesis", summary, "User"))

    return DebateResponse(
        job_id=job_id,
        status="completed",
        summary=summary,
        traces=traces
    )

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "Multi-Agent Debate"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
