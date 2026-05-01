#!/usr/bin/env bash
# Short wrapper: push canonical workflow.json to n8n (see docs/DEVELOPMENT.md).
# Usage: from repo root, ./tools/deploy.sh wf01 | ./tools/deploy.sh unwrap | ./tools/deploy.sh all [--dry-run ...]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec node tools/push-workflow-to-n8n-api.mjs "$@"
