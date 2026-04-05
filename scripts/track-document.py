#!/usr/bin/env python3
"""
track-document.py — PostToolUse hook for Write|Edit tools.
Appends a log row to documents/activity-log.md for managed files.
Ported from .opencode/plugins/document-tracker.ts
"""
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

WORKSPACE = os.environ.get("CLAUDE_PLUGIN_OPTION_WORKSPACE_ROOT", os.getcwd())
MANAGED_FOLDERS = {"documents", "research", "notes", "exports"}

DOC_TYPES = {
    "leads": "Lead", "prd": "PRD", "frd": "FRD",
    "tasks": "Task", "goals": "Goal", "research": "Research",
    "notes": "Note", "projects": "Project", "templates": "Template",
}


def is_managed(file_path: str) -> bool:
    normalized = file_path.replace("\\", "/")
    return any(f"/{folder}/" in normalized or normalized.startswith(f"{folder}/")
               for folder in MANAGED_FOLDERS)


def get_doc_type(file_path: str) -> str:
    normalized = file_path.replace("\\", "/")
    for folder, dtype in DOC_TYPES.items():
        if f"/{folder}/" in normalized:
            return dtype
    return "Document"


def append_log(log_file: Path, doc_type: str, action: str, filename: str):
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    if not log_file.exists():
        log_file.parent.mkdir(parents=True, exist_ok=True)
        log_file.write_text(
            "# Document Activity Log\n\n"
            "Automatically tracked by lead-agent plugin. Do not edit manually.\n\n"
            "| Timestamp (UTC) | Type | Action | File |\n"
            "|-----------------|------|--------|------|\n",
            encoding="utf-8",
        )
    with log_file.open("a", encoding="utf-8") as f:
        f.write(f"| {timestamp} | {doc_type} | {action} | `{filename}` |\n")


def main():
    raw = sys.stdin.read()
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return

    tool = data.get("tool_name", "")
    if tool not in ("Write", "Edit"):
        return

    inp = data.get("tool_input", {})
    file_path = inp.get("file_path") or inp.get("path") or ""
    if not file_path or not is_managed(file_path):
        return

    doc_type = get_doc_type(file_path)
    filename = Path(file_path).name
    action = "Created" if tool == "Write" else "Edited"
    log_file = Path(WORKSPACE) / "documents" / "activity-log.md"

    try:
        append_log(log_file, doc_type, action, filename)
    except Exception:
        pass


if __name__ == "__main__":
    try:
        main()
    except Exception:
        sys.exit(0)
