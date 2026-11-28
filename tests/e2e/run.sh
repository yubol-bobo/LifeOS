#!/usr/bin/env bash
# Run browser check scripts; fail unless each one exits 0, prints no FAIL line and prints ALL PASS.
# Usage: LIFEOS_URL=http://localhost:5173/ tests/e2e/run.sh tests/e2e/tree.cjs [more.cjs ...]
set -uo pipefail
status=0
for script in "$@"; do
  echo "::group::$script"
  out=$(mktemp)
  node "$script" 2>&1 | tee "$out"
  code=${PIPESTATUS[0]}
  echo "::endgroup::"
  if [ "$code" -ne 0 ]; then
    echo "::error::$script exited with $code"; status=1
  elif grep -q '^FAIL' "$out"; then
    echo "::error::$script: $(grep -c '^FAIL' "$out") check(s) failed"; grep '^FAIL' "$out"; status=1
  elif ! grep -qx 'ALL PASS' "$out"; then
    echo "::error::$script did not print ALL PASS"; status=1
  else
    echo "$script: ALL PASS"
  fi
  rm -f "$out"
done
exit $status
