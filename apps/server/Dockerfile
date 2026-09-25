FROM node:20-alpine AS base

# ffmpeg decodes the demo recordings into the raw PCM the Gemini Live API expects.
RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/

RUN npm install

COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/server

EXPOSE 4000

CMD ["npm", "run", "start", "--workspace=apps/server"]
