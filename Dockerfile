FROM node:17-alpine

WORKDIR /app

COPY package*.json ./

RUN npm i
RUN npm i --save typescript ts-node ts-node-dev

COPY . .

RUN echo "Generating prisma"
RUN npx prisma generate

EXPOSE 8080

CMD [ "/bin/sh", "entry-dev.sh" ]