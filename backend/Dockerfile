FROM node:22.11.0-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY src ./src
EXPOSE 5000
CMD ["node", "src/index.js"]
