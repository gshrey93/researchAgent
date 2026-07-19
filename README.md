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

## Setup & Prerequisites

### Prerequisites

Ensure you have the following installed on your machine:
- **Python**: 3.10 or higher
- **Node.js**: v18.0.0 or higher (`npm` included)
- **Gemini API Key**: Obtain a free API key from [Google AI Studio](https://aistudio.google.com/apikey)

---

## Installation & Setup

### 1. Environment Configuration

Copy the example environment file and add your Gemini API Key:

```bash
cp .env.example .env
```

Open `.env` in your editor and set your key:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

### 2. Backend Setup

From the project root directory, set up a Python virtual environment and install the required packages:

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows (Command Prompt / PowerShell):
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup

Navigate into the `frontend` directory and install Node modules:

```bash
cd frontend
npm install
cd ..
```

---

## Running the Application

To run the application, you need to start both the **FastAPI Backend** and the **Vite Frontend**.

### Step 1: Start the Backend Server

From the project root directory (with virtual environment activated):

```bash
uvicorn backend.main:app --reload --port 8000
```
> The backend will be running at `http://localhost:8000`. You can test API endpoints and view interactive Swagger docs at `http://localhost:8000/docs`.

### Step 2: Start the Frontend Development Server

In a new terminal window, navigate to the `frontend` directory and run:

```bash
cd frontend
npm run dev
```
> The frontend development server will launch at `http://localhost:5173`.

### Step 3: Open the Web Application

Open your browser and navigate to:
**[http://localhost:5173](http://localhost:5173)**

Enter any research query (e.g., *"Latest developments in quantum computing"* or *"State of AI in drug discovery"*) to observe ARIA perform live web searches, fetch web pages, and structure comprehensive research reports.

---

## System Guidelines & Specifications

For detailed information on ARIA's agent prompt, research rules, tool declarations, and inner loop specifications, see [Instructions.md](file:///Users/shreyash/projects/aria/Instructions.md).

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
