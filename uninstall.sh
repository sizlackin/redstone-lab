#!/usr/bin/env bash
# Removes Redstone Lab from your computer: the app folder, the app menu entry, the icon,
# the redstone-lab command and the app's saved settings. Electron and the GitHub repo stay.
#
#   bash ~/.local/share/redstone-lab/uninstall.sh

main() {
  local data_home config_home cmd icons
  data_home="${XDG_DATA_HOME:-$HOME/.local/share}"
  config_home="${XDG_CONFIG_HOME:-$HOME/.config}"
  icons="$data_home/icons/hicolor"
  cmd="$HOME/.local/bin/redstone-lab"
  rm -f "$data_home/applications/redstone-lab.desktop" \
    "$icons/256x256/apps/redstone-lab.png" \
    "$icons/512x512/apps/redstone-lab.png" \
    "$icons/scalable/apps/redstone-lab.svg"
  # The terminal command: a link (older installs) or the small launcher install.sh wrote.
  if [ -L "$cmd" ] || { [ -f "$cmd" ] && grep -q 'Redstone Lab launcher' "$cmd"; }; then rm -f "$cmd"; fi
  rm -rf "$data_home/redstone-lab" "$data_home/redstone-lab-browser" "$config_home/Redstone Lab"
  update-desktop-database "$data_home/applications" >/dev/null 2>&1 || true
  if [ -d "$icons" ]; then
    touch "$icons"
    if [ -f "$icons/icon-theme.cache" ]; then gtk-update-icon-cache -q -t "$icons" >/dev/null 2>&1 || true; fi
  fi
  echo "Redstone Lab has been removed. Your GitHub repo is untouched."
}

main "$@"
exit $?
