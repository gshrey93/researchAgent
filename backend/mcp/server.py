#!/usr/bin/env python3
"""
ARIA MCP Server — Stdio server exposing research tools.

Tools:
  - web_search: DuckDuckGo web search
  - fetch_page: HTTP page fetch + content extraction
  - structure_report: AI-powered report structuring via Gemini
"""

import json
import os

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("aria-research-tools")


@mcp.tool()
async def web_search(query: str, max_results: int = 5) -> str:
    """Search the web using DuckDuckGo and return structured results.

    Args:
        query: The search query string.
        max_results: Maximum number of results to return (default 5).

    Returns:
        JSON string containing a list of {title, url, snippet} objects.
    """
    from duckduckgo_search import DDGS

    try:
        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=max_results):
                results.append(
                    {
                        "title": r.get("title", ""),
                        "url": r.get("href", ""),
                        "snippet": r.get("body", "")[:300],
                    }
                )
        return json.dumps(results, indent=2)
    except Exception as e:
        return json.dumps({"error": f"Search failed: {str(e)}"})


@mcp.tool()
async def fetch_page(url: str) -> str:
    """Fetch a web page and extract its text content.

    Strips scripts, styles, navigation, and footer elements.
    Content is truncated to 3000 characters. Never raises exceptions.

    Args:
        url: The URL to fetch.

    Returns:
        JSON string with {url, content} on success or {url, error} on failure.
    """
    import httpx
    from bs4 import BeautifulSoup

    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=15.0,
        ) as client:
            response = await client.get(
                url,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/120.0.0.0 Safari/537.36 "
                        "ARIA-Research-Bot/1.0"
                    )
                },
            )
            response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Remove unwanted elements
        for tag in soup(
            [
                "script",
                "style",
                "nav",
                "footer",
                "header",
                "aside",
                "iframe",
                "noscript",
                "svg",
                "form",
            ]
        ):
            tag.decompose()

        text = soup.get_text(separator="\n", strip=True)
        # Collapse whitespace
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        content = "\n".join(lines)[:3000]

        return json.dumps({"url": url, "content": content})
    except Exception as e:
        return json.dumps({"url": url, "error": f"Fetch failed: {str(e)}"})


@mcp.tool()
async def structure_report(topic: str, findings: str) -> str:
    """Structure raw research findings into a formatted JSON report using Gemini.

    Args:
        topic: The research topic.
        findings: Raw compiled findings text to structure.

    Returns:
        JSON string with structured report containing summary, key_findings,
        sources, confidence level, and word_count.
    """
    import google.generativeai as genai

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return json.dumps({"error": "GEMINI_API_KEY environment variable not set"})

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")

    prompt = f"""You are a research report structurer. Given a research topic and raw findings,
produce a polished, well-structured report in JSON format.

Topic: {topic}

Raw Findings:
{findings}

Return ONLY valid JSON with this exact structure (no markdown fences):
{{
    "summary": "A comprehensive 2-3 paragraph summary of the findings (200-400 words)",
    "key_findings": ["finding 1", "finding 2", "...up to 10 findings"],
    "sources": [{{"title": "source title", "url": "https://..."}}, ...],
    "confidence": "high|medium|low",
    "word_count": <integer word count of summary>
}}

Guidelines:
- The summary must be detailed, informative, and well-written
- Include 5-10 key findings, each a clear and concise statement
- List all referenced URLs as sources with descriptive titles
- Set confidence based on source quality, consistency, and coverage:
  high = multiple authoritative sources agreeing
  medium = some good sources but gaps exist
  low = limited or conflicting information
- word_count should accurately count the words in your summary

Return ONLY the JSON object, nothing else."""

    try:
        response = await model.generate_content_async(prompt)
        text = response.text.strip()

        # Strip markdown code fences if present
        if text.startswith("```"):
            first_newline = text.find("\n")
            if first_newline != -1:
                text = text[first_newline + 1 :]
            last_fence = text.rfind("```")
            if last_fence != -1:
                text = text[:last_fence]
            text = text.strip()

        # Validate JSON
        parsed = json.loads(text)

        # Ensure required fields
        report = {
            "summary": parsed.get("summary", ""),
            "key_findings": parsed.get("key_findings", []),
            "sources": parsed.get("sources", []),
            "confidence": parsed.get("confidence", "medium"),
            "word_count": parsed.get("word_count", len(parsed.get("summary", "").split())),
        }
        return json.dumps(report, indent=2)

    except json.JSONDecodeError:
        # If JSON parsing fails, wrap raw text as a low-confidence report
        return json.dumps(
            {
                "summary": text[:2000] if text else "Failed to structure report",
                "key_findings": [],
                "sources": [],
                "confidence": "low",
                "word_count": len(text.split()) if text else 0,
            }
        )
    except Exception as e:
        return json.dumps({"error": f"Report structuring failed: {str(e)}"})


if __name__ == "__main__":
    mcp.run()
