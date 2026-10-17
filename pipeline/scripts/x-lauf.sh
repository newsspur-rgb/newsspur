#!/bin/zsh
# X-Stimmen-Lauf für launchd (alle 3 Std). Kopie außerhalb von ~/Desktop, weil macOS dort Hintergrund-Zugriff sperrt.
# Braucht: Mac wach, Chrome offen, bei x.com eingeloggt.
export PATH="$HOME/.nvm/versions/node/v26.8.1/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd "$HOME/newsspur-x" || exit 1
git pull -q --ff-only 2>/dev/null
cd pipeline
pgrep -q "Google Chrome" || { echo "$(date) Chrome ist zu – Lauf übersprungen"; exit 0; }
npm run --silent x:run
