#!/bin/bash

echo "Starting the entry-dev.sh script"
npx prisma migrate dev --name init
echo "Running the server"
npm run start