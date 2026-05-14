#!/usr/bin/env bash
# MDD Branch Guard
# PreToolUse hook — blocks Write/Edit/NotebookEdit on main/master in MDD projects.
# Installed by: mdd install (into .claude/hooks/ or ~/.claude/hooks/)

# Only active in MDD projects
[ -d ".mdd" ] || exit 0

# Check current branch
BRANCH=$(git branch --show-current 2>/dev/null)
[ -z "$BRANCH" ] && exit 0

# Only block on main/master
[[ "$BRANCH" == "main" || "$BRANCH" == "master" ]] || exit 0

# Check for uncommitted changes
CHANGES=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

# Clean working tree — auto-create a branch and allow the write
if [ "$CHANGES" -eq 0 ]; then
  AUTO_BRANCH="mdd/session-$(date +%Y%m%d-%H%M%S)"
  git checkout -b "$AUTO_BRANCH" 2>/dev/null
  echo ""
  echo "  MDD Branch Guard: auto-created branch '${AUTO_BRANCH}' (was on ${BRANCH})"
  echo ""
  exit 0
fi

# Dirty working tree — block to prevent losing work
echo ""
echo "⛔  MDD BRANCH GUARD"
echo ""
echo "    File modification is blocked on branch '${BRANCH}'."
echo "    You have ${CHANGES} uncommitted change(s). Commit or stash first:"
echo ""
echo "      git add -A && git commit -m 'wip: ...' && git checkout -b feat/<name>"
echo "      — or —"
echo "      git stash && git checkout -b feat/<name>"
echo ""

exit 2
