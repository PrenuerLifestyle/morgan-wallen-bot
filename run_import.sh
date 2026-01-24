#!/usr/bin/env bash
# One-click runner for import_from_site.js
# - Installs node deps (puppeteer, pg, node-fetch, minimist)
# - Runs the importer in API or DB mode
#
# Usage:
#   ./run_import.sh https://stilltheproblem.vercel.app/ api
#   ./run_import.sh https://stilltheproblem.vercel.app/ db

set -e

URL=$1
MODE=${2:-api}

if [ -z "$URL" ]; then
  echo "Usage: $0 <target-url> [api|db]"
  exit 1
fi

# Ensure .env exists
if [ ! -f .env ]; then
  echo ".env file not found. Copy .env from the template and fill credentials."
  exit 1
fi

# Install deps (local temporary node_modules)
if [ ! -d node_modules ]; then
  echo "Installing dependencies (puppeteer may download Chromium) — this may take a minute..."
  npm install puppeteer pg node-fetch minimist dotenv
fi

echo "Running importer for $URL in mode=$MODE"
node import_from_site.js --url="$URL" --mode="$MODE"
