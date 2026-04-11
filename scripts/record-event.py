#!/usr/bin/env python3
"""
record-event.py — append one analytics event to .analytics/events.jsonl.

Called by hooks. Reads the hook context from stdin (JSON) and takes the event
type as argv[1]. Must exit 0 on any error so it never blocks the session.

The analytics MCP server (analytics-server.js) reads this file and imports
rows into MongoDB via mongoose when the `analytics_flush` tool is called.
"""
import sys
import os
import json
import time
import pathlib


def main():
    event_type = sys.argv[1] if len(sys.argv) > 1 else "unknown"
    workspace = os.environ.get("WORKSPACE_ROOT") or os.environ.get("CLAUDE_PROJECT_DIR") or ""
    if not workspace:
        sys.exit(0)

    analytics_dir = pathlib.Path(workspace) / ".analytics"
    try:
        analytics_dir.mkdir(parents=True, exist_ok=True)
    except Exception:
        sys.exit(0)
    log_path = analytics_dir / "events.jsonl"

    # Hook context is JSON on stdin
    try:
        raw = sys.stdin.read()
        ctx = json.loads(raw) if raw.strip() else {}
    except Exception:
        ctx = {}

    tool_name = ctx.get("tool_name") or ""
    tool_input = ctx.get("tool_input") or {}
    tool_response = ctx.get("tool_response")
    prompt_text = ctx.get("prompt") or ""

    # Decide actor: for tool_use events use the tool name; for prompts use 'user'
    if event_type == "prompt":
        actor = "user"
    elif event_type == "tool_use":
        actor = tool_name or "unknown_tool"
    elif event_type == "session_start":
        actor = "system"
    elif event_type == "stop":
        actor = "system"
    else:
        actor = tool_name or "system"

    # Keep payload compact — truncate big strings so JSONL stays readable
    def trunc(x, n=2000):
        if x is None:
            return None
        s = x if isinstance(x, str) else json.dumps(x, default=str)
        return s if len(s) <= n else s[:n] + f"...[{len(s) - n} more chars]"

    payload = {
        "tool_name": tool_name or None,
        "tool_input": tool_input if tool_input else None,
        "tool_response_length": len(str(tool_response)) if tool_response is not None else 0,
        "tool_response_preview": trunc(tool_response, 500) if tool_response else None,
        "prompt": trunc(prompt_text, 4000) if prompt_text else None,
        "cwd": ctx.get("cwd"),
        "subagent_type": (tool_input or {}).get("subagent_type"),
    }
    # Drop None values to keep the log clean
    payload = {k: v for k, v in payload.items() if v is not None and v != 0}

    event = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "session_id": ctx.get("session_id") or os.environ.get("CLAUDE_SESSION_ID") or "unknown",
        "workspace": workspace,
        "type": event_type,
        "actor": actor,
        "payload": payload,
    }

    try:
        with log_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(event, default=str) + "\n")
    except Exception:
        pass

    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        sys.exit(0)
