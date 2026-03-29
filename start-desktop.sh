#!/bin/bash
# Start Electron Desktop App

echo "=========================================="
echo "Starting Skin Cancer Detection Desktop App"
echo "=========================================="
echo.

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Navigate to desktop-app
cd "$SCRIPT_DIR/desktop-app"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start Electron app
echo "Starting Electron app..."
npm start
