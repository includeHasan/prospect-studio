#!/usr/bin/env python3
"""
track-search.py — PostToolUse hook for search tools.
Appends a log row to research/search-log.md.
Ported from .opencode/plugins/lead-research.ts
"""
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

WORKSPACE = os.environ.get("CLAUDE_PLUGIN_OPTION_WORKSPACE_ROOT", os.getcwd())


def extract_query(data: dict) -> str:
    tool = data.get("tool_name", "")
    inp = data.get("tool_input", {})

    # SerpAPI MCP variants
    if "serpapi" in tool.lower():
        return str(inp.get("params", {}).get("q") or inp.get("q") or "")

    # Claude Code WebFetch
    if tool == "WebFetch":
        return str(inp.get("url", ""))

    # Claude Code WebSearch
    if tool == "WebSearch":
        return str(inp.get("query") or inp.get("search_query") or "")

    return ""


def append_log(log_file: Path, tool: str, query: str):
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    safe_query = query.replace("|", "\\|")[:120]

    if not log_file.exists():
        log_file.parent.mkdir(parents=True, exist_ok=True)
        log_file.write_text(
            "# Research Search Log\n\n"
            "Automatically tracked by lead-agent plugin. Do not edit manually.\n\n"
            "| Timestamp (UTC) | Tool | Query |\n"
            "|-----------------|------|-------|\n",
            encoding="utf-8",
        )
    with log_file.open("a", encoding="utf-8") as f:
        f.write(f"| {timestamp} | {tool} | {safe_query} |\n")


def main():
    raw = sys.stdin.read()
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return

    query = extract_query(data)
    if not query:
        return

    tool = data.get("tool_name", "unknown")
    log_file = Path(WORKSPACE) / "research" / "search-log.md"

    try:
        append_log(log_file, tool, query)
    except Exception:
        pass


if __name__ == "__main__":
    try:
        main()
    except Exception:
        sys.exit(0)
