#!/usr/bin/env bash
# Makes the installed Redstone Lab folder match the newest version on GitHub.
# The first word it prints says what happened:
#   updated <commit message>   downloaded a newer version
#   current                    already had the newest version
#   offline                    couldn't reach GitHub
#   broken <file>              the newest version's launcher script has a typo, so it was skipped
#   busy                       another update was already running
#   not-installed              this isn't the copy made by install.sh, so it was left alone
# Only the copy made by install.sh is ever changed (it has a marker file in .git). A copy you cloned
# yourself to edit is never touched. In the installed copy, changes made by hand are undone.
set -u
DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"
BRANCH="${REDSTONE_LAB_BRANCH:-main}"
WAIT="${REDSTONE_LAB_SYNC_TIMEOUT:-20}" # seconds to wait for GitHub before giving up
export GIT_TERMINAL_PROMPT=0             # never stop and ask for a password

cd "$DIR" || exit 1
if [ ! -f .git/redstone-lab-installed ]; then
  echo not-installed
  exit 5
fi
command -v git >/dev/null 2>&1 || { echo offline; echo "git is not installed" >&2; exit 2; }

# One update at a time (for example when the app is opened twice in a row).
if command -v flock >/dev/null 2>&1; then
  exec 9>.git/redstone-lab-sync.lock
  flock -w "$WAIT" 9 || { echo busy; exit 6; }
fi

before="$(git rev-parse -q --verify HEAD 2>/dev/null || echo none)"
if ! timeout "$WAIT" git fetch --quiet --depth 1 origin "$BRANCH"; then
  echo offline
  exit 3
fi
after="$(git rev-parse FETCH_HEAD)" || { echo offline; exit 3; }

# A typo in a launcher script would stop the app from opening at all, so check them first.
for f in linux/start.sh linux/sync.sh; do
  if ! git show "$after:$f" 2>/dev/null | bash -n 2>/dev/null; then
    echo "broken $f"
    exit 4
  fi
done

git reset --quiet --hard "$after" || { echo offline; exit 3; }
if [ "$before" = "$after" ]; then
  echo current
else
  echo "updated $(git log -1 --format=%s)"
fi
