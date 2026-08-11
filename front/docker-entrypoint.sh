#!/bin/sh
set -e

cat > /app/public/runtime-config.js <<EOF
window.__ENV__ = window.__ENV__ || {};
window.__ENV__.API_URL = "${API_URL}";
window.__ENV__.CLARITY_PROJECT_ID = "${CLARITY_PROJECT_ID}";
EOF

exec "$@"
