"""
ARIA FastAPI Backend — Research Intelligence Agent API.

Endpoints:
  POST /api/research  → SSE stream of research events
  GET  /api/health    → Health check

Features:
  - CORS enabled for localhost:5173
  - Input validation (topic 3-200 chars)
  - In-memory rate limiting (5 req/min per IP)
"""

import json
import logging
import time
from collections import defaultdict
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import mcp_client
from .llm import research_topic

# Load environment variables from .env
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Rate Limiting ────────────────────────────────────────────────────────────
_request_log: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_MAX = 5
RATE_LIMIT_WINDOW = 60  # seconds


def _check_rate_limit(client_ip: str) -> bool:
    """Check if a client IP is within the rate limit.

    Returns True if the request is allowed, False if rate-limited.
    """
    now = time.time()
    # Prune old entries
    _request_log[client_ip] = [
        t for t in _request_log[client_ip] if now - t < RATE_LIMIT_WINDOW
    ]
    if len(_request_log[client_ip]) >= RATE_LIMIT_MAX:
        return False
    _request_log[client_ip].append(now)
    return True


# ── App Lifecycle ────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup/shutdown lifecycle."""
    logger.info("🚀 ARIA backend starting up...")

    # Pre-warm MCP connection
    try:
        await mcp_client.get_session()
        tools = await mcp_client.list_tools()
        logger.info(f"✅ MCP server connected. Tools: {[t.name for t in tools]}")
    except Exception as e:
        logger.warning(f"⚠️  MCP pre-warm failed (will retry on first request): {e}")

    yield

    # Shutdown
    await mcp_client.shutdown()
    logger.info("👋 ARIA backend shut down.")


# ── FastAPI App ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="ARIA — Autonomous Research Intelligence Agent",
    description="AI-powered autonomous research agent with live tool calling",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request/Response Models ──────────────────────────────────────────────────
class ResearchRequest(BaseModel):
    topic: str = Field(
        ...,
        min_length=3,
        max_length=200,
        description="Research topic (3-200 characters)",
        examples=["AI in drug discovery", "Quantum computing 2026"],
    )


# ── Endpoints ────────────────────────────────────────────────────────────────
@app.post("/api/research")
async def research(request: Request, body: ResearchRequest):
    """Start an autonomous research session.

    Returns a Server-Sent Events stream with real-time updates:
      - tool_start: A tool is about to be called
      - tool_result: A tool has returned results
      - complete: Research finished with a structured report
      - error: Something went wrong

    Rate limited to 5 requests per minute per IP.
    """
    client_ip = request.client.host if request.client else "unknown"

    if not _check_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Rate limit exceeded",
                "message": f"Maximum {RATE_LIMIT_MAX} requests per minute. Please wait and try again.",
                "retry_after": RATE_LIMIT_WINDOW,
            },
        )

    logger.info(f"📋 New research request from {client_ip}: '{body.topic}'")

    async def event_stream():
        try:
            async for event in research_topic(body.topic):
                data = json.dumps(event, ensure_ascii=False)
                yield f"data: {data}\n\n"
        except Exception as e:
            logger.exception(f"Stream error for topic '{body.topic}'")
            error_event = json.dumps(
                {"type": "error", "message": f"Stream error: {str(e)}"}
            )
            yield f"data: {error_event}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "ARIA",
        "version": "1.0.0",
    }
