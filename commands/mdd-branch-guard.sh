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

# Dirty working tree — block and ask the user what to do
echo ""
echo "⛔  MDD BRANCH GUARD"
echo ""
echo "    Branch '${BRANCH}' has ${CHANGES} uncommitted change(s)."
echo "    Use AskUserQuestion to ask the user:"
echo "    Question: 'You have uncommitted changes on ${BRANCH}. How would you like to proceed?'"
echo "    Options:"
echo "      1. Commit changes — run: git add -A && git commit -m 'wip: save before branch' && git checkout -b feat/<name>"
echo "      2. Stash changes — run: git stash && git checkout -b feat/<name>"
echo "      3. Cancel — do nothing"
echo "    For options 1 and 2, replace feat/<name> with a branch name derived from the task at hand."
echo ""

exit 2
