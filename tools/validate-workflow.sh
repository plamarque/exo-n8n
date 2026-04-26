#!/usr/bin/env bash
# Resolve portfolio workflow id (wf01..wf04 or unwrap) to workflow.json and run
# validate-workflow-json.mjs. Optional --emit-sdk with no path writes work/<id>.generated.mjs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

usage() {
  echo "Usage: $0 wf01|wf02|wf03|wf04|unwrap [--emit-sdk [path]] ..." >&2
  echo "  Validates workflows/<id>-*/workflow.json (or unwrap sub-workflow)." >&2
  echo "  --emit-sdk alone → work/<id>.generated.mjs (gitignored)." >&2
  exit 1
}

[[ $# -ge 1 ]] || usage
ID="$1"
shift

resolve_json() {
  shopt -s nullglob
  case "$ID" in
    wf01 | wf02 | wf03 | wf04)
      local matches=(workflows/"${ID}"-*/workflow.json)
      if [[ ${#matches[@]} -eq 0 ]]; then
        echo "No match for workflows/${ID}-*/workflow.json" >&2
        exit 1
      fi
      if [[ ${#matches[@]} -gt 1 ]]; then
        echo "Ambiguous: more than one workflows/${ID}-*/workflow.json" >&2
        printf '  %s\n' "${matches[@]}" >&2
        exit 1
      fi
      printf '%s' "${matches[0]}"
      ;;
    unwrap)
      local p="workflows/shared/subworkflows/unwrap-mcp-json/workflow.json"
      if [[ ! -f "$p" ]]; then
        echo "Missing $p" >&2
        exit 1
      fi
      printf '%s' "$p"
      ;;
    *)
      echo "Unknown workflow id: $ID (use wf01..wf04 or unwrap)" >&2
      exit 1
      ;;
  esac
}

JSON="$(resolve_json)"

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
