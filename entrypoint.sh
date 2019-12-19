#!/bin/bash

npm run setup
cd server && npm run db:migrate && cd ..
npx npm-run-all -p client server