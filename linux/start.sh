#!/usr/bin/env bash
# Opens Redstone Lab.
# 1. In the installed copy, quickly checks GitHub for a newer version and downloads it
#    (skipped when you're offline, and never done in a copy you cloned yourself).
# 2. Opens the app with Electron. If Electron isn't installed, it opens it in app mode of a
#    Chromium-based browser (Chromium, Chrome, Brave, Vivaldi, Edge), or else your default browser.
# Everything runs inside main(), so it's safe for an update to replace this file while it runs.

main() {
  local dir url electron browser result
  dir="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"

  if [ -f "$dir/.git/redstone-lab-installed" ]; then
    export REDSTONE_LAB_MANAGED=1
    if [ "${REDSTONE_LAB_NO_UPDATE:-0}" != 1 ]; then
      result="$(REDSTONE_LAB_SYNC_TIMEOUT="${REDSTONE_LAB_SYNC_TIMEOUT:-8}" bash "$dir/linux/sync.sh" 2>/dev/null)"
      case "$result" in
        updated*)
          export REDSTONE_LAB_UPDATED=1
          export REDSTONE_LAB_UPDATE_MSG="${result#updated }"
          ;;
      esac
    fi
  fi

  electron="$(find_electron)"
  if [ -n "$electron" ]; then
    exec "$electron" --ozone-platform-hint=auto "$dir" "$@"
  fi

  url="file://$dir/app/index.html"
  if [ "${REDSTONE_LAB_UPDATED:-0}" = 1 ]; then
    url="$url?updated=1&msg=$(urlencode "${REDSTONE_LAB_UPDATE_MSG:-}")"
  fi
  browser="$(find_browser)"
  if [ -n "$browser" ]; then
    exec "$browser" --app="$url" --class=redstone-lab \
      --user-data-dir="${XDG_DATA_HOME:-$HOME/.local/share}/redstone-lab-browser" \
      --no-first-run --no-default-browser-check
  fi
  exec xdg-open "$dir/app/index.html"
}

find_electron() {
  local e
  if [ -n "${REDSTONE_LAB_ELECTRON:-}" ] && command -v "$REDSTONE_LAB_ELECTRON" >/dev/null 2>&1; then
    echo "$REDSTONE_LAB_ELECTRON"
    return
  fi
  if command -v electron >/dev/null 2>&1; then
    echo electron
    return
  fi
  # Versioned packages, e.g. electron44 on Arch / CachyOS. Pick the newest.
  e="$(compgen -c electron | grep -E '^electron[0-9]+$' | sort -V | tail -n 1)"
  [ -n "$e" ] && echo "$e"
}

find_browser() {
  local b
  for b in chromium chromium-browser google-chrome-stable google-chrome brave brave-browser \
    vivaldi-stable vivaldi microsoft-edge-stable thorium-browser; do
    if command -v "$b" >/dev/null 2>&1; then
      echo "$b"
      return
    fi
  done
}

urlencode() {
  local LC_ALL=C s="$1" out="" c i
  for ((i = 0; i < ${#s}; i++)); do
    c="${s:i:1}"
    case "$c" in
      [a-zA-Z0-9.~_-]) out+="$c" ;;
      *) out+="$(printf '%%%02X' "'$c")" ;;
    esac
  done
  printf '%s' "$out"
}

main "$@"
exit $?
