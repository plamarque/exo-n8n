#!/usr/bin/env bash
# Short wrapper: push canonical workflow.json to n8n (see docs/DEVELOPMENT.md).
# Usage: ./deploy.sh wf01 | ./deploy.sh wf04 --dry-run | ./deploy.sh unwrap
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
exec node tools/push-workflow-to-n8n-api.mjs "$@"
