"""
ARIA LLM Agent — Gemini tool-use agentic loop.

Runs a multi-step research workflow:
  1. Searches the web (at least twice)
  2. Fetches promising pages (at least 3)
  3. Structures findings into a final report

Yields SSE-formatted events for real-time frontend updates.
"""

import json
import logging
import os
import time
from typing import AsyncGenerator

import google.generativeai as genai

from . import mcp_client

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are ARIA (Autonomous Research Intelligence Agent). Your mission is to thoroughly research a given topic using the tools at your disposal.

## Research Methodology (MUST follow this order):
1. **Search Phase**: Call web_search at least TWICE with different, complementary queries to get broad coverage of the topic. Use varied angles — e.g., one general query and one more specific or recent.
2. **Deep Dive Phase**: Review search results and call fetch_page on at least 3 of the most promising, authoritative URLs. Prioritize diverse sources (news, academic, industry).
3. **Synthesis Phase**: Once you have gathered enough information from fetched pages, call structure_report ONCE with the topic and ALL your compiled findings.

## Critical Rules:
- NEVER call structure_report before fetching at least 3 pages
- NEVER call structure_report before doing at least 2 web searches
- Include ALL gathered information in the findings parameter of structure_report
- Do not repeat the same search query
- Skip URLs that are likely paywalled or login-gated
- Prefer .edu, .gov, .org, and reputable news sources when available
- If a fetch_page fails, try a different URL instead

## Quality Standards:
- Aim for comprehensive, multi-perspective coverage
- Note when sources disagree or when information is uncertain
- Include dates and attribution when available in your findings"""

MAX_ITERATIONS = 15

# Tool declarations for Gemini function calling
_TOOL_DECLARATIONS = [
    {
        "function_declarations": [
            {
                "name": "web_search",
                "description": (
                    "Search the web using DuckDuckGo. Returns a JSON list of "
                    "{title, url, snippet} objects. Use varied queries for "
                    "comprehensive coverage."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search query string",
                        },
                        "max_results": {
                            "type": "integer",
                            "description": "Maximum results to return (default 5, max 10)",
                        },
                    },
                    "required": ["query"],
                },
            },
            {
                "name": "fetch_page",
                "description": (
                    "Fetch and extract text content from a web page URL. "
                    "Returns {url, content} on success or {url, error} on failure. "
                    "Content is truncated to 3000 chars."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "url": {
                            "type": "string",
                            "description": "The full URL to fetch",
                        },
                    },
                    "required": ["url"],
                },
            },
            {
                "name": "structure_report",
                "description": (
                    "Structure raw research findings into a formatted JSON report. "
                    "Call ONLY after completing at least 2 searches and 3 page fetches. "
                    "Pass ALL gathered findings."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "topic": {
                            "type": "string",
                            "description": "The research topic",
                        },
                        "findings": {
                            "type": "string",
                            "description": "All compiled raw findings from searches and page fetches",
                        },
                    },
                    "required": ["topic", "findings"],
                },
            },
        ]
    }
]


async def research_topic(topic: str) -> AsyncGenerator[dict, None]:
    """Run the agentic research loop for a given topic.

    Yields SSE event dicts:
        {"type": "tool_start", "tool": str, "input": dict}
        {"type": "tool_result", "tool": str, "result": str}
        {"type": "complete", "report": dict}
        {"type": "error", "message": str}

    Args:
        topic: The research topic to investigate.
    """
    # Validate API key
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        yield {"type": "error", "message": "GEMINI_API_KEY is not configured. Please set it in your .env file."}
        return

    try:
        genai.configure(api_key=api_key)

        model = genai.GenerativeModel(
            "gemini-2.0-flash",
            system_instruction=SYSTEM_PROMPT,
            tools=_TOOL_DECLARATIONS,
        )

        chat = model.start_chat()

        # Kick off the research
        response = await chat.send_message_async(
            f"Research the following topic thoroughly: {topic}"
        )

        iteration = 0

        while iteration < MAX_ITERATIONS:
            # Extract function calls from response
            function_calls = []
            for part in response.parts:
                if hasattr(part, "function_call") and part.function_call.name:
                    function_calls.append(part.function_call)

            # If no function calls, the model is done
            if not function_calls:
                text_parts = []
                for part in response.parts:
                    if hasattr(part, "text") and part.text:
                        text_parts.append(part.text)

                if text_parts:
                    combined = "\n".join(text_parts)
                    # Try to parse as JSON report
                    try:
                        report = json.loads(combined)
                        if "summary" in report:
                            yield {"type": "complete", "report": report}
                            return
                    except json.JSONDecodeError:
                        pass

                    # Wrap raw text as a report
                    yield {
                        "type": "complete",
                        "report": {
                            "summary": combined[:3000],
                            "key_findings": [],
                            "sources": [],
                            "confidence": "low",
                            "word_count": len(combined.split()),
                        },
                    }
                return

            # Process each function call
            function_responses = []

            for fc in function_calls:
                tool_name = fc.name
                tool_args = dict(fc.args) if fc.args else {}

                # Clean up args — convert proto values to Python types
                clean_args = {}
                for k, v in tool_args.items():
                    if isinstance(v, (str, int, float, bool)):
                        clean_args[k] = v
                    else:
                        clean_args[k] = str(v)

                # Emit tool_start
                yield {
                    "type": "tool_start",
                    "tool": tool_name,
                    "input": clean_args,
                }

                start_time = time.time()

                # Execute tool via MCP client
                try:
                    result = await mcp_client.call_tool(tool_name, clean_args)
                except Exception as e:
                    result = json.dumps({"error": str(e)})
                    logger.error(f"Tool '{tool_name}' execution failed: {e}")

                elapsed = round(time.time() - start_time, 2)

                # Check if structure_report succeeded — emit complete
                if tool_name == "structure_report":
                    try:
                        report = json.loads(result)
                        if "error" not in report and "summary" in report:
                            yield {
                                "type": "tool_result",
                                "tool": tool_name,
                                "result": f"Report structured successfully ({elapsed}s)",
                            }
                            yield {"type": "complete", "report": report}
                            return
                    except json.JSONDecodeError:
                        pass

                # Truncate result for SSE display (full result goes to Gemini)
                display_result = result[:500] + "…" if len(result) > 500 else result
                yield {
                    "type": "tool_result",
                    "tool": tool_name,
                    "result": display_result,
                }

                # Build function response for Gemini
                function_responses.append(
                    genai.protos.Part(
                        function_response=genai.protos.FunctionResponse(
                            name=tool_name,
                            response={"result": result},
                        )
                    )
                )

            iteration += 1

            # Send all function responses back to Gemini
            try:
                response = await chat.send_message_async(function_responses)
            except Exception as e:
                logger.error(f"Gemini API error on iteration {iteration}: {e}")
                yield {"type": "error", "message": f"AI model error: {str(e)}"}
                return

        # Max iterations exceeded
        yield {
            "type": "error",
            "message": (
                f"Research stopped after {MAX_ITERATIONS} tool call iterations. "
                "The topic may be too broad — try a more specific query."
            ),
        }

    except Exception as e:
        logger.exception("Unhandled error in research loop")
        yield {"type": "error", "message": f"Research failed: {str(e)}"}
