#!/bin/bash

echo "Starting the entry-dev.sh script"
npx prisma migrate deploy
echo "Running the server"
npm run dev