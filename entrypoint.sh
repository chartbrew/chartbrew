#!/bin/bash

# all env vars used in the client app need to be set here as well
export VITE_APP_API_HOST=${VITE_APP_API_HOST}
export VITE_APP_CLIENT_HOST=${VITE_APP_CLIENT_HOST}
export VITE_APP_CLIENT_PORT=${VITE_APP_CLIENT_PORT}
export VITE_APP_ONE_ACCOUNT_EXTERNAL_ID=${VITE_APP_ONE_ACCOUNT_EXTERNAL_ID}

cd server
NODE_ENV=production nohup node index.js &

cd ../client
# mkdir -p dist

# Build the UI in the background
# nohup sh -c 'echo "The UI is rebuilding. Please wait..." && npm run build && echo "UI built successfully!" && cp -rf build/* dist/' &
nohup sh -c 'echo "The UI is rebuilding. Please wait..." && npm run build && echo "UI built successfully!"' &

# Serve the UI
npx serve -s dist -l ${VITE_APP_CLIENT_PORT}
