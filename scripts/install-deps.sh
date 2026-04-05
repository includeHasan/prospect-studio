#!/usr/bin/env bash
# install-deps.sh — Install MCP server node_modules to CLAUDE_PLUGIN_DATA.
# Runs on SessionStart. Silently succeeds or fails — never interrupts the session.

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
PLUGIN_DATA="${CLAUDE_PLUGIN_DATA}"
SRC_PKG="${PLUGIN_ROOT}/mcp-server/package.json"
DST_PKG="${PLUGIN_DATA}/package.json"

mkdir -p "${PLUGIN_DATA}"

# Install if package.json is missing or has changed (first run or plugin update)
if ! diff -q "${SRC_PKG}" "${DST_PKG}" >/dev/null 2>&1; then
  cp "${SRC_PKG}" "${DST_PKG}" && \
    cd "${PLUGIN_DATA}" && \
    npm install --quiet --no-fund --no-audit 2>/dev/null || \
    rm -f "${DST_PKG}"
fi

exit 0
