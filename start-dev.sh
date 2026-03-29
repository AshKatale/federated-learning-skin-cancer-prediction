#!/bin/bash
# Start Federated Learning System (All Components)

echo "=========================================="
echo "Starting Federated Learning System"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Function to start a service in background
start_service() {
    local name=$1
    local cmd=$2
    local dir=$3
    
    echo -e "${BLUE}Starting ${name}...${NC}"
    cd "$dir"
    eval "$cmd" &
    echo -e "${GREEN}✓ ${name} started (PID: $!)${NC}"
}

# Kill all processes on exit
cleanup() {
    echo -e "${YELLOW}\nShutting down all services...${NC}"
    pkill -f "flask"
    pkill -f "npm start"
    pkill -f "python fl_server.py"
    echo -e "${GREEN}Services stopped${NC}"
}

trap cleanup EXIT INT TERM

# Check if Node.js and Python are installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js not found. Please install Node.js${NC}"
    exit 1
fi

if ! command -v python &> /dev/null; then
    echo -e "${YELLOW}Python not found. Please install Python 3.8+${NC}"
    exit 1
fi

echo -e "${BLUE}Starting Backend Services${NC}"
echo "================================"

# Install dependencies if needed
echo "Checking dependencies..."
cd "$SCRIPT_DIR/server"
npm install --quiet 2>/dev/null

cd "$SCRIPT_DIR/federated-learning"
pip install -q -r requirements.txt 2>/dev/null

# Start Node.js server
start_service "Node.js Backend" "npm start" "$SCRIPT_DIR/server"
sleep 2

# Start Flask ML server
start_service "Python ML Server" "python app.py" "$SCRIPT_DIR/ml-model"
sleep 2

# Start Flower FL server
start_service "Flower FL Server" "python fl_server.py" "$SCRIPT_DIR/federated-learning"
sleep 2

# Start React frontend
start_service "React Frontend" "npm start" "$SCRIPT_DIR/client"
sleep 3

echo ""
echo -e "${GREEN}=========================================="
echo "Federated Learning System Ready!"
echo "=========================================${NC}"
echo ""
echo -e "${BLUE}Services:${NC}"
echo "  Frontend:      http://localhost:3000"
echo "  Backend:       http://localhost:3001"
echo "  ML Server:     http://localhost:5000"
echo "  FL Server:     localhost:8080"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for all background processes
wait
