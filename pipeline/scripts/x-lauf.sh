#!/bin/zsh
# X-Stimmen-Lauf für launchd (alle 3 Std). Braucht: Mac wach, Chrome offen, bei x.com eingeloggt.
export PATH="$HOME/.nvm/versions/node/v26.8.1/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd "$(dirname "$0")/.." || exit 1
pgrep -q "Google Chrome" || { echo "$(date) Chrome ist zu – Lauf übersprungen"; exit 0; }
npm run --silent x:run
