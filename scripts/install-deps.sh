#!/usr/bin/env bash
# install-deps.sh — Install MCP server node_modules next to the server files.
#
# Must install into ${CLAUDE_PLUGIN_ROOT}/mcp-server/node_modules (not
# CLAUDE_PLUGIN_DATA) because Node's ESM module resolution walks up from the
# importer's filesystem location looking for node_modules. NODE_PATH is CJS-only
# and does NOT work for `import` statements — so putting deps in a separate
# data dir silently breaks every local MCP server.
#
# Runs on SessionStart. Silently succeeds or fails — never interrupts the session.

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
SERVER_DIR="${PLUGIN_ROOT}/mcp-server"
PKG="${SERVER_DIR}/package.json"
LOCK_MARKER="${SERVER_DIR}/node_modules/.package-hash"

if [ ! -f "${PKG}" ]; then
  exit 0
fi

# Compute a rough hash of package.json so we re-install on changes
CURRENT_HASH=""
if command -v sha256sum >/dev/null 2>&1; then
  CURRENT_HASH=$(sha256sum "${PKG}" | awk '{print $1}')
elif command -v shasum >/dev/null 2>&1; then
  CURRENT_HASH=$(shasum -a 256 "${PKG}" | awk '{print $1}')
else
  CURRENT_HASH=$(wc -c < "${PKG}")
fi

SAVED_HASH=""
if [ -f "${LOCK_MARKER}" ]; then
  SAVED_HASH=$(cat "${LOCK_MARKER}" 2>/dev/null)
fi

if [ "${CURRENT_HASH}" = "${SAVED_HASH}" ] && [ -d "${SERVER_DIR}/node_modules" ]; then
  # Already installed and unchanged
  exit 0
fi

# Install / reinstall
cd "${SERVER_DIR}" && \
  npm install --quiet --no-fund --no-audit --omit=dev 2>/dev/null && \
  echo "${CURRENT_HASH}" > "${LOCK_MARKER}"

exit 0
