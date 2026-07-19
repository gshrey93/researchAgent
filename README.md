# ARIA — Autonomous Research Intelligence Agent

An AI-powered research agent that autonomously searches, reads, and synthesizes web content into structured reports — with live tool-call visualization.

![Stack](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![Stack](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![Stack](https://img.shields.io/badge/Gemini-4285F4?style=flat&logo=google&logoColor=white)
![Stack](https://img.shields.io/badge/MCP-6366f1?style=flat)

## How It Works

1. Enter a research topic
2. ARIA autonomously calls **web_search** → **fetch_page** → **structure_report**
3. Watch live tool calls stream in real-time
4. Get a structured report with summary, key findings, and sources

## Quick Start

```bash
# 1. Configure
cp .env.example .env
# Add your Gemini API key (https://aistudio.google.com/apikey)

# 2. Backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000

# 3. Frontend (new terminal)
cd frontend && npm install && npm run dev
```

Open **http://localhost:5173**

## Architecture

```
User → React Frontend (SSE) → FastAPI Backend → Gemini Agent Loop → MCP Client → MCP Server (stdio)
                                                                                    ├── web_search (DuckDuckGo)
                                                                                    ├── fetch_page (httpx + BS4)
                                                                                    └── structure_report (Gemini)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Vite |
| Styling | Pure CSS dark theme |
| Backend | Python FastAPI + Uvicorn |
| AI | Google Gemini 2.0 Flash |
| Tools | MCP stdio server (web search, page fetch, report structuring) |

## License

MIT
