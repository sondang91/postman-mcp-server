#!/bin/bash

# Script để lấy đường dẫn tuyệt đối cho Cursor MCP config
# Chạy script này để copy đường dẫn vào clipboard hoặc hiển thị

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_PATH="$SCRIPT_DIR/dist/index.js"

echo "📍 Đường dẫn tuyệt đối cho Cursor MCP config:"
echo ""
echo "$DIST_PATH"
echo ""
echo "📋 Copy đoạn này vào phần 'args' trong MCP config:"
echo ""
echo "\"args\": [\"$DIST_PATH\"]"
echo ""

# Copy vào clipboard trên macOS
if command -v pbcopy &> /dev/null; then
    echo "$DIST_PATH" | pbcopy
    echo "✅ Đã copy vào clipboard! Paste vào Cursor MCP config."
else
    echo "⚠️  Không thể tự động copy. Hãy copy đường dẫn ở trên."
fi

echo ""
echo "📝 File config của Cursor thường ở:"
echo "   ~/Library/Application Support/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json"
echo ""
