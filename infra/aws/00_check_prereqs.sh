#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
source env.sh

echo "Checking prerequisites..."

for cmd in aws jq curl; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: Required command '$cmd' not found. Please install it."
    exit 1
  fi
  echo "  ✓ $cmd: $(command -v $cmd)"
done

echo "All prerequisites satisfied."
