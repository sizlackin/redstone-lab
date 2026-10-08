#!/usr/bin/env bash
# Installs Redstone Lab for your user account. Run this in a terminal (not as root):
#
#   curl -fsSL https://raw.githubusercontent.com/sizlackin/redstone-lab/main/install.sh | bash
#
# What it does:
#   1. Downloads the app from GitHub into ~/.local/share/redstone-lab
#   2. Offers to install Electron (the window the app runs in) if you don't have it yet
#   3. Adds "Redstone Lab" to your app menu, plus a `redstone-lab` command for the terminal
# After that, every time you open the app it first grabs the newest version from GitHub.
# Running this again is safe: it refreshes everything, and it repairs the app if it ever stops opening.

main() {
  set -euo pipefail
  local repo_url branch data_home app_dir bin_dir apps_dir icons answer electron
  repo_url="${REDSTONE_LAB_REPO:-https://github.com/sizlackin/redstone-lab.git}"
  branch="${REDSTONE_LAB_BRANCH:-main}"
  data_home="${XDG_DATA_HOME:-$HOME/.local/share}"
  app_dir="$data_home/redstone-lab"
  bin_dir="$HOME/.local/bin"
  apps_dir="$data_home/applications"
  icons="$data_home/icons/hicolor"

  if [ "$(id -u)" -eq 0 ] && [ "${REDSTONE_LAB_ALLOW_ROOT:-0}" != 1 ]; then
    fail "Please run this as yourself, not as root (no sudo in front). It only asks for your password if it installs Electron."
  fi
  command -v git >/dev/null 2>&1 || fail "git is needed first. On CachyOS or Arch run:  sudo pacman -S git"

  # 1. Get the app
  if [ -d "$app_dir/.git" ]; then
    say "Updating Redstone Lab in $app_dir"
    git -C "$app_dir" remote set-url origin "$repo_url"
    git -C "$app_dir" fetch --quiet --depth 1 origin "$branch" ||
      fail "Couldn't reach GitHub. Check your internet connection and try again."
    git -C "$app_dir" reset --quiet --hard FETCH_HEAD
  else
    if [ -e "$app_dir" ]; then
      fail "$app_dir already exists but isn't a Redstone Lab install. Move it somewhere else and run this again."
    fi
    say "Downloading Redstone Lab into $app_dir"
    mkdir -p "$data_home"
    git clone --quiet --depth 1 --branch "$branch" "$repo_url" "$app_dir" ||
      fail "Couldn't download the app from GitHub. Check your internet connection and try again."
  fi
  # Marks this folder as the installed copy: only this copy updates itself from GitHub.
  touch "$app_dir/.git/redstone-lab-installed"

  # 2. Electron
  electron="$(find_electron)"
  if [ -n "$electron" ]; then
    say "Found Electron ($electron)"
  elif command -v pacman >/dev/null 2>&1; then
    # -Syu refreshes pacman's list of packages first. With an old list, pacman asks the download
    # servers for an Electron version they've already deleted, and the install fails.
    say "Redstone Lab runs in Electron, which isn't installed yet. Installing it runs:"
    say "  sudo pacman -Syu --needed electron"
    say "That also installs any system updates you haven't done yet, and asks for your password."
    answer="n"
    if [ "${REDSTONE_LAB_YES:-0}" = 1 ]; then
      answer="y"
    elif has_tty; then
      printf '  Install Electron now? [Y/n] '
      read -r answer </dev/tty || answer="n"
      answer="${answer:-y}"
    fi
    case "$answer" in
      [Yy]*)
        # pacman reads its own "Proceed?" question from the keyboard, not from this script's input.
        # shellcheck disable=SC2024 # (the keyboard is yours; sudo doesn't need to open it)
        if has_tty; then
          sudo pacman -Syu --needed electron </dev/tty || say "Electron didn't install. You can try again later with:  sudo pacman -Syu electron"
        else
          sudo pacman -Syu --needed --noconfirm electron </dev/null || say "Electron didn't install. You can try again later with:  sudo pacman -Syu electron"
        fi
        ;;
      *) say "Skipped. You can install it later with:  sudo pacman -Syu electron   (until then the app opens in a browser)." ;;
    esac
  else
    say "Electron isn't installed. Install it with your package manager for the best experience."
    say "Until then the app opens in Chromium, Chrome or Brave (app mode), or your default browser."
  fi

  # 3. App menu entry, icon and terminal command
  mkdir -p "$apps_dir" "$icons/256x256/apps" "$icons/512x512/apps" "$icons/scalable/apps" "$bin_dir"
  cp "$app_dir/app/icon.png" "$icons/256x256/apps/redstone-lab.png"
  cp "$app_dir/linux/icon-512.png" "$icons/512x512/apps/redstone-lab.png"
  cp "$app_dir/app/icon.svg" "$icons/scalable/apps/redstone-lab.svg"
  refresh_icons "$icons"

  # The `redstone-lab` command. (rm first: an older install made this a link to start.sh.)
  rm -f "$bin_dir/redstone-lab"
  cat >"$bin_dir/redstone-lab" <<EOF
#!/usr/bin/env bash
# Redstone Lab launcher, written by install.sh.
exec bash "$app_dir/linux/start.sh" "\$@"
EOF
  chmod +x "$bin_dir/redstone-lab"

  cat >"$apps_dir/redstone-lab.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Redstone Lab
GenericName=Redstone Simulator
Comment=Learn Minecraft redstone on a drag-and-drop grid
Exec=bash "$app_dir/linux/start.sh"
Icon=redstone-lab
Terminal=false
Categories=Education;Simulation;
Keywords=minecraft;redstone;circuit;simulator;
StartupWMClass=redstone-lab
StartupNotify=true
EOF
  update-desktop-database "$apps_dir" >/dev/null 2>&1 || true

  say "Done! Open 'Redstone Lab' from your app menu, or type  redstone-lab  in a terminal."
  case ":$PATH:" in
    *":$bin_dir:"*) ;;
    *) say "(The redstone-lab command needs $bin_dir in your PATH. The app menu entry works either way.)" ;;
  esac
}

say() {
  if [ -t 1 ]; then printf '\033[1;31m■\033[0m %s\n' "$*"; else printf '■ %s\n' "$*"; fi
}
fail() { printf 'Problem: %s\n' "$*" >&2; exit 1; }
# True when there's a real keyboard to ask (also when this script arrives through curl | bash).
has_tty() { { : </dev/tty; } 2>/dev/null; }

find_electron() {
  local e
  if command -v electron >/dev/null 2>&1; then
    echo electron
    return
  fi
  e="$(compgen -c electron | grep -E '^electron[0-9]+$' | sort -V | tail -n 1)"
  [ -n "$e" ] && echo "$e"
  return 0
}

# Let icon-using apps notice the new icons. Only rebuild GTK's icon list if one already exists:
# creating a new one would hide icons that other apps add later.
refresh_icons() {
  touch "$1"
  if [ -f "$1/icon-theme.cache" ]; then gtk-update-icon-cache -q -t "$1" >/dev/null 2>&1 || true; fi
}

main "$@"
exit $?
