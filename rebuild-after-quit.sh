#!/bin/bash
# Script to rebuild MCP server after quitting Cursor
echo "🔨 Rebuilding Postman MCP Server..."
cd "$(dirname "$0")"
npm run build
if [ $? -eq 0 ]; then
  echo "✅ Build successful!"
  echo ""
  echo "📋 Next steps:"
  echo "1. Open Cursor"
  echo "2. Try: Create folder TestMCPServer in Postman collection 97f3e1da-a4e9-44f6-8d1a-83766a827e54"
else
  echo "❌ Build failed. Check errors above."
fi
