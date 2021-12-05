#!/bin/bash

echo "Starting the entry.sh script"
npx prisma migrate deploy
echo "Running the server"
npm run start