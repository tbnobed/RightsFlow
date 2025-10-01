#!/bin/sh
set -e

echo "Building frontend with Vite..."
npx vite build

echo "Building production server with esbuild..."
npx esbuild server/production.ts \
  --platform=node \
  --packages=external \
  --bundle \
  --format=esm \
  --outdir=dist \
  --alias:@shared=./shared

echo "Build complete!"
