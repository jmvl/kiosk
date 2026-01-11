#!/bin/bash

# Kiosk Project - Development Environment Setup
# ==============================================
# This script sets up and runs the development environment for the
# Gamified Supermarket Kiosk MVP project.

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Kiosk Development Environment Setup  ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check Node.js version
echo -e "${YELLOW}Checking Node.js version...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed.${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Error: Node.js 18+ is required (found v$(node -v))${NC}"
    exit 1
fi
echo -e "${GREEN}Node.js $(node -v) detected${NC}"

# Check npm
echo -e "${YELLOW}Checking npm...${NC}"
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed.${NC}"
    exit 1
fi
echo -e "${GREEN}npm $(npm -v) detected${NC}"

# Install dependencies
echo ""
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install

# Check if Convex CLI is available
echo ""
echo -e "${YELLOW}Checking Convex CLI...${NC}"
if ! npx convex --version &> /dev/null; then
    echo -e "${YELLOW}Convex CLI will be installed with dependencies${NC}"
fi
echo -e "${GREEN}Convex CLI ready${NC}"

# Check environment files
echo ""
echo -e "${YELLOW}Checking environment configuration...${NC}"
if [ -f ".env.development" ]; then
    echo -e "${GREEN}.env.development found${NC}"
else
    echo -e "${YELLOW}Creating .env.development from template...${NC}"
    cat > .env.development << 'EOF'
# Convex Backend
VITE_CONVEX_URL=https://your-convex-url.convex.site

# Kiosk Configuration
VITE_KIOSK_ID=kiosk-001
VITE_LANGUAGE=fr

# Development
VITE_DEV_MODE=true
EOF
    echo -e "${YELLOW}Please update VITE_CONVEX_URL in .env.development${NC}"
fi

# Display available commands
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Available Commands                   ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Development:${NC}"
echo "  npm run dev           - Start Vite development server (http://localhost:5173)"
echo "  npm run convex        - Start Convex backend development mode"
echo "  npm run electron:dev  - Start Electron app with hot reload"
echo ""
echo -e "${GREEN}Testing:${NC}"
echo "  npm run test          - Run unit tests with Vitest"
echo "  npm run test:ui       - Run tests with UI"
echo "  npm run lint          - Run ESLint"
echo "  npm run type-check    - Run TypeScript type checking"
echo ""
echo -e "${GREEN}Production:${NC}"
echo "  npm run build         - Build for production"
echo "  npm run package       - Package Electron app for Linux"
echo "  npm run convex:deploy - Deploy Convex to production"
echo ""

# Quick start instructions
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Quick Start                          ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "To start development, run these in separate terminals:"
echo ""
echo -e "  ${YELLOW}Terminal 1:${NC} npm run convex"
echo -e "  ${YELLOW}Terminal 2:${NC} npm run dev"
echo ""
echo "Or for Electron development:"
echo -e "  ${YELLOW}Terminal 1:${NC} npm run convex"
echo -e "  ${YELLOW}Terminal 2:${NC} npm run electron:dev"
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Setup complete!${NC}"
echo -e "${BLUE}========================================${NC}"
