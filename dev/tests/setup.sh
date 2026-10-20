#!/bin/sh
# One-time setup for the suites: Playwright with Chromium, and Pillow for the icon tool.
set -e
python3 -c "import playwright, PIL" 2>/dev/null || pip install --break-system-packages playwright pillow
python3 -c "from playwright.sync_api import sync_playwright as s
with s() as p: p.chromium.launch().close()" 2>/dev/null || python3 -m playwright install chromium
echo "Setup done."
