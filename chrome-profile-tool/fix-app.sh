#!/bin/bash

# Script to fix "damaged app" error on macOS
# Run this after downloading the app

APP_PATH="$1"

if [ -z "$APP_PATH" ]; then
    echo "Usage: ./fix-app.sh <path-to-app>"
    echo "Example: ./fix-app.sh '/Applications/JEG Profile Manager.app'"
    exit 1
fi

if [ ! -d "$APP_PATH" ]; then
    echo "Error: App not found at $APP_PATH"
    exit 1
fi

echo "Removing quarantine attribute from: $APP_PATH"
xattr -cr "$APP_PATH"

echo "Done! You can now open the app."
echo "If it still doesn't work, right-click the app and select 'Open'"
