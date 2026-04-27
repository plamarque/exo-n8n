#!/usr/bin/env bash
# Pull workflow.json from n8n (see docs/DEVELOPMENT.md).
# Usage: from repo root, ./tools/download_workflow.sh wf01 | ./tools/download_workflow.sh wf03 --dry-run
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec node tools/download-workflow-from-n8n-api.mjs "$@"
