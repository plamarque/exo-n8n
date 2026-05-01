#!/usr/bin/env bash
# Resolve workflow shortId to workflow.json and run validate-workflow-json.mjs.
# shortId = folder name under workflows/ before first "-" (or full name if no hyphen).
# Optional --emit-sdk with no path writes work/<id>.generated.mjs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

usage() {
  echo "Usage: $0 <shortId> [--emit-sdk [path]] ..." >&2
  echo "  Resolves workflows/<name>/workflow.json via tools/resolve-workflow-json.mjs." >&2
  echo "  --emit-sdk alone → work/<shortId>.generated.mjs (gitignored)." >&2
  exit 1
}

[[ $# -ge 1 ]] || usage
ID="$1"
shift

if ! JSON_REL="$(node tools/resolve-workflow-json.mjs "$ID")"; then
  exit 1
fi
JSON="$JSON_REL"

# Build args: if --emit-sdk has no path (next missing or is another flag), default work/<id>.generated.mjs
args=()
positional=("$@")
i=0
while [[ $i -lt ${#positional[@]} ]]; do
  a="${positional[$i]}"
  if [[ "$a" == "--emit-sdk" ]]; then
    args+=("--emit-sdk")
    next_idx=$((i + 1))
    if [[ $next_idx -ge ${#positional[@]} ]] || [[ "${positional[$next_idx]}" == -* ]]; then
      args+=("work/${ID}.generated.mjs")
    else
      args+=("${positional[$next_idx]}")
      i=$next_idx
    fi
  else
    args+=("$a")
  fi
  i=$((i + 1))
done

if [[ ${#args[@]} -eq 0 ]]; then
  exec node tools/validate-workflow-json.mjs "$JSON"
else
  exec node tools/validate-workflow-json.mjs "$JSON" "${args[@]}"
fi
