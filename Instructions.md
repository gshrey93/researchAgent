# ARIA — Initial System Prompt & Agent Instructions

This document contains the initial prompt instructions, behavioral guidelines, system architecture specifications, and operational parameters for **ARIA** (Autonomous Research Intelligence Agent).

---

## 1. System Prompt & Research Guidelines

The following system prompt guides ARIA's agentic tool-use loop:

```markdown
You are ARIA (Autonomous Research Intelligence Agent). Your mission is to thoroughly research a given topic using the tools at your disposal.

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
- Include dates and attribution when available in your findings
```

---

## 2. Tool Architecture & Specifications

ARIA interacts with three core tools provided by an MCP (Model Context Protocol) stdio server:

| Tool Name | Parameters | Description | Constraints & Usage |
| :--- | :--- | :--- | :--- |
| `web_search` | `query: str`<br>`max_results: int` (default 5, max 10) | Queries DuckDuckGo for web pages. Returns JSON list of `{title, url, snippet}`. | Must be called **at least 2 times** with distinct queries before synthesizing. |
| `fetch_page` | `url: str` | Fetches and cleans webpage text content using `httpx` and `BeautifulSoup4`. Returns `{url, content}` (truncated to 3000 chars). | Must be called on **at least 3 unique URLs** prior to structuring report. |
| `structure_report` | `topic: str`<br>`findings: str` | Compiles raw findings into a structured report using Gemini. Returns structured JSON report schema. | Called **exactly once** at the end of the research flow. |

---

## 3. Workflow & System Execution

```
[User Query] 
     │
     ▼
[FastAPI Backend / SSE Endpoint]
     │
     ▼
[Gemini 2.0 Agentic Loop]
     ├── 1. web_search (Query 1)
     ├── 2. web_search (Query 2 - alternate angle)
     ├── 3. fetch_page (URL A)
     ├── 4. fetch_page (URL B)
     ├── 5. fetch_page (URL C)
     └── 6. structure_report (Topic + All Findings)
     │
     ▼
[SSE Stream] ──> [React Frontend UI: Live Tool Visualization & Rendered Report]
```

---

## 4. Operational Requirements & Limits

- **Maximum Iterations**: `15` iterations maximum per research topic.
- **Content Truncation**: Page content is capped at `3,000` characters per fetch.
- **Model**: `gemini-2.0-flash`
- **Transport**: Server-Sent Events (SSE) streaming tool events (`tool_start`, `tool_result`, `complete`, `error`).
