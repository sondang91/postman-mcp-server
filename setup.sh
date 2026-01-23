#!/bin/bash

# Postman MCP Server Setup Script
# This script helps set up the Postman MCP Server for Cursor IDE

set -e

echo "🚀 Postman MCP Server Setup"
echo "============================"
echo ""

# Check Node.js version
echo "📋 Checking Node.js version..."
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Error: Node.js 18+ is required. Current version: $(node --version)"
  exit 1
fi
echo "✅ Node.js version: $(node --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Build project
echo "🔨 Building project..."
npm run build
echo "✅ Build completed"
echo ""

# Check for API key
if [ -z "$POSTMAN_API_KEY" ]; then
  echo "⚠️  POSTMAN_API_KEY environment variable is not set"
  echo ""
  echo "To set it up:"
  echo "1. Get your API key from: https://web.postman.co/settings/me/api-keys"
  echo "2. Export it: export POSTMAN_API_KEY='your-api-key'"
  echo "3. Or add it to Cursor MCP config directly"
  echo ""
else
  echo "✅ POSTMAN_API_KEY is set"
fi

# Get absolute path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_PATH="$SCRIPT_DIR/dist/index.js"

echo ""
echo "✅ Setup completed!"
echo ""
echo "📝 Next steps:"
echo "1. Add this to your Cursor MCP configuration:"
echo ""
echo "{"
echo "  \"postman\": {"
echo "    \"command\": \"node\","
echo "    \"args\": [\"$DIST_PATH\"],"
echo "    \"env\": {"
echo "      \"POSTMAN_API_KEY\": \"your-postman-api-key-here\""
echo "    }"
echo "  }"
echo "}"
echo ""
echo "2. Restart Cursor IDE"
echo "3. Test with: \"List all Postman collections\""
echo ""
