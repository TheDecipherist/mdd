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

# Count uncommitted changes for context
CHANGES=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

echo ""
echo "⛔  MDD BRANCH GUARD"
echo ""
echo "    File modification is blocked on branch '${BRANCH}'."
echo "    MDD never writes files directly on main or master."
echo ""
if [ "$CHANGES" -gt 0 ]; then
  echo "    You have ${CHANGES} uncommitted change(s). Commit or stash first:"
  echo ""
  echo "      git add -A && git commit -m 'wip: ...' && git checkout -b feat/<name>"
  echo "      — or —"
  echo "      git stash && git checkout -b feat/<name>"
else
  echo "    Create a feature branch, then re-run your /mdd command:"
  echo ""
  echo "      git checkout -b feat/<feature-name>"
fi
echo ""

exit 2
