"""
ARIA MCP Client — Singleton module-level client for the ARIA MCP server.

Manages a single subprocess connection to the MCP stdio server.
Handles reconnection if the subprocess dies.
Thread-safe via asyncio.Lock.
"""

import asyncio
import logging
import os
import sys
from pathlib import Path
from typing import Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

logger = logging.getLogger(__name__)

# Path to the MCP server script
_SERVER_PATH = str(Path(__file__).parent / "mcp" / "server.py")

# Singleton state
_session: ClientSession | None = None
_transport_ctx: Any = None
_session_ctx: Any = None
_lock = asyncio.Lock()
_initialized = False


async def get_session() -> ClientSession:
    """Get or create the singleton MCP client session.

    If the session is dead (subprocess crashed), it will be
    automatically cleaned up and a fresh connection established.

    Returns:
        An active ClientSession connected to the MCP server.

    Raises:
        RuntimeError: If the MCP server cannot be started.
    """
    global _session, _initialized

    async with _lock:
        # If we have a session, health-check it
        if _session is not None and _initialized:
            try:
                await asyncio.wait_for(_session.list_tools(), timeout=5.0)
                return _session
            except Exception:
                logger.warning("MCP session health check failed, reconnecting...")
                await _cleanup_unlocked()

        # Establish a new connection
        await _connect_unlocked()
        assert _session is not None
        return _session


async def _connect_unlocked() -> None:
    """Start the MCP server subprocess and establish a session.

    Must be called while holding _lock.
    """
    global _session, _transport_ctx, _session_ctx, _initialized

    logger.info(f"Starting MCP server: {sys.executable} {_SERVER_PATH}")

    # Build environment — inherit current env so GEMINI_API_KEY is available
    env = {**os.environ}

    server_params = StdioServerParameters(
        command=sys.executable,
        args=[_SERVER_PATH],
        env=env,
    )

    try:
        # Manually enter the async context managers so we can hold them open
        _transport_ctx = stdio_client(server_params)
        read, write = await _transport_ctx.__aenter__()

        _session_ctx = ClientSession(read, write)
        _session = await _session_ctx.__aenter__()

        await _session.initialize()
        _initialized = True

        tools = await _session.list_tools()
        tool_names = [t.name for t in tools.tools]
        logger.info(f"MCP client connected. Tools available: {tool_names}")

    except Exception as e:
        logger.error(f"Failed to connect to MCP server: {e}")
        await _cleanup_unlocked()
        raise RuntimeError(f"MCP server connection failed: {e}") from e


async def call_tool(name: str, arguments: dict) -> str:
    """Call a tool on the MCP server by name.

    Automatically reconnects if the session has died.

    Args:
        name: Tool name (web_search, fetch_page, structure_report).
        arguments: Dictionary of tool arguments.

    Returns:
        Combined text content from the tool's response.
    """
    session = await get_session()

    try:
        result = await asyncio.wait_for(
            session.call_tool(name, arguments),
            timeout=60.0,  # generous timeout for web fetches
        )
    except asyncio.TimeoutError:
        raise RuntimeError(f"Tool call '{name}' timed out after 60 seconds")
    except Exception as e:
        # Session might be dead — mark for reconnection
        logger.error(f"Tool call '{name}' failed: {e}")
        raise

    # Extract text content from MCP result
    text_parts = []
    for content_block in result.content:
        if hasattr(content_block, "text"):
            text_parts.append(content_block.text)
    return "\n".join(text_parts) if text_parts else ""


async def list_tools() -> list:
    """List all available tools from the MCP server.

    Returns:
        List of tool descriptors.
    """
    session = await get_session()
    result = await session.list_tools()
    return list(result.tools)


async def _cleanup_unlocked() -> None:
    """Clean up the current session and transport. Must hold _lock."""
    global _session, _transport_ctx, _session_ctx, _initialized

    _initialized = False

    if _session_ctx is not None:
        try:
            await _session_ctx.__aexit__(None, None, None)
        except Exception as e:
            logger.debug(f"Session cleanup error (ignored): {e}")

    if _transport_ctx is not None:
        try:
            await _transport_ctx.__aexit__(None, None, None)
        except Exception as e:
            logger.debug(f"Transport cleanup error (ignored): {e}")

    _session = None
    _session_ctx = None
    _transport_ctx = None


async def shutdown() -> None:
    """Gracefully shut down the MCP client and kill the subprocess."""
    async with _lock:
        await _cleanup_unlocked()
        logger.info("MCP client shut down.")
