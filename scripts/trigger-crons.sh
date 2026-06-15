#!/bin/bash
# Manually fires Anna's four zero-cost crons right now.
# Run after seed-prospects.js so Anna has targets to work with.
#
# Usage:
#   chmod +x scripts/trigger-crons.sh
#   ./scripts/trigger-crons.sh

set -e

# Parse .env.local
ENV_FILE="$(dirname "$0")/../.env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env.local not found"
  exit 1
fi

CRON_SECRET=$(grep -E '^CRON_SECRET=' "$ENV_FILE" | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'")
SITE_URL=$(grep -E '^NEXT_PUBLIC_SITE_URL=' "$ENV_FILE" | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$CRON_SECRET" ]; then
  echo "Error: CRON_SECRET not found in .env.local"
  exit 1
fi
if [ -z "$SITE_URL" ]; then
  echo "Error: NEXT_PUBLIC_SITE_URL not found in .env.local"
  exit 1
fi

echo ""
echo "🚀  Triggering Anna's crons against: $SITE_URL"
echo ""

trigger() {
  local name=$1
  local path=$2
  echo -n "  ▶  $name ... "
  response=$(curl -s -o /tmp/anna_cron_response.json -w "%{http_code}" \
    -H "Authorization: Bearer $CRON_SECRET" \
    "$SITE_URL$path")
  body=$(cat /tmp/anna_cron_response.json 2>/dev/null || echo '{}')
  if [ "$response" = "200" ]; then
    echo "✓ ($response)"
    # Print key fields from the JSON response
    echo "     $(echo "$body" | grep -o '"[a-z_]*":[0-9]*\|"message":"[^"]*"' | head -4 | tr '\n' '  ')"
  else
    echo "✗ ($response)"
    echo "     $body"
  fi
  echo ""
}

# 1. Contact form targets — drafts personalized messages for the 20 seeded prospects
trigger "contact-form-targets (drafts 20 outreach messages)" "/api/cron/contact-form-targets"

# 2. FEMA monitor — checks if any Colorado disaster declarations exist right now
trigger "fema-monitor (checks FEMA for CO disasters)" "/api/cron/fema-monitor"

# 3. Reddit monitor — scans r/Denver, r/Boulder etc for hail/roofer posts
trigger "reddit-monitor (scans Colorado subreddits)" "/api/cron/reddit-monitor"

# 4. Storm check — queries NWS for active Colorado hail right now
trigger "storm-check (checks NWS for active hail)" "/api/cron/storm-check"

echo "✅  All done."
echo ""
echo "Check results:"
echo "  Contact form drafts → /admin (or /intel)"
echo "  Anna war room        → /anna"
echo ""
