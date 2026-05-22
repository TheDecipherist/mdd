#!/usr/bin/env bash
# MDD v1 phase logger — writes to ~/.claude/mdd/log.md
# Usage: mdd-log-phase.sh COMMAND PHASE EVENT [CONTEXT]
COMMAND="${1:-mdd}"
PHASE="${2:-unknown}"
EVENT="${3:-start}"
CONTEXT="${4:--}"
LOG="$HOME/.claude/mdd/log.md"
DATE=$(date '+%Y-%m-%d')
TIME=$(date '+%H:%M:%S')

TOKENS=$(compressmcp --status 2>/dev/null | grep -oE "[0-9]+K/[0-9]+K" | head -1)
[ -z "$TOKENS" ] && TOKENS="-"

mkdir -p "$HOME/.claude/mdd"

if [ ! -f "$LOG" ]; then
  printf '# MDD v1 Command Log\n\nTracks every `/mdd` command run. Use this to benchmark mdd v1 against mdd2.\n\n## Sessions\n\n| Date | Command | Project | Start | End | Duration | Context |\n|------|---------|---------|-------|-----|----------|---------|\n\n## Phase Log\n\n| Date | Command | Phase | Event | Context | Time | Tokens |\n|------|---------|-------|-------|---------|------|--------|\n' > "$LOG"
else
  # Migrate old 4-column Phase Log header
  if grep -q "| Date | Phase | Event | Time |" "$LOG" 2>/dev/null; then
    sed -i 's/| Date | Phase | Event | Time |/| Date | Command | Phase | Event | Context | Time | Tokens |/' "$LOG"
    sed -i 's/|------|-------|-------|------|/|------|---------|-------|-------|---------|------|--------|/' "$LOG"
  # Migrate 6-column header (no Context column)
  elif grep -q "| Date | Command | Phase | Event | Time | Tokens |" "$LOG" 2>/dev/null; then
    sed -i 's/| Date | Command | Phase | Event | Time | Tokens |/| Date | Command | Phase | Event | Context | Time | Tokens |/' "$LOG"
    sed -i 's/|------|---------|-------|-------|------|--------|/|------|---------|-------|-------|---------|------|--------|/' "$LOG"
  elif ! grep -q "## Phase Log" "$LOG" 2>/dev/null; then
    printf '\n## Phase Log\n\n| Date | Command | Phase | Event | Context | Time | Tokens |\n|------|---------|-------|-------|---------|------|--------|\n' >> "$LOG"
  fi
fi

printf "| %s | %s | %s | %s | %s | %s | %s |\n" \
  "$DATE" "$COMMAND" "$PHASE" "$EVENT" "$CONTEXT" "$TIME" "$TOKENS" >> "$LOG"
