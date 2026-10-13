# Cloudflare Containers run linux/amd64; LiteParse ships a native binary per platform.
FROM node:22-slim

# The build context is only this folder, so the workspace catalog and lockfile are out of reach.
# Dev dependencies (which use `catalog:`) are dropped before installing.
RUN corepack enable && corepack prepare pnpm@12.4.1 --activate

WORKDIR /app

ADD --chmod=644 https://github.com/tesseract-ocr/tessdata_best/raw/main/eng.traineddata /app/tessdata/eng.traineddata
RUN chmod 755 /app/tessdata

COPY package.json ./
RUN node -e 'const fs=require("node:fs");const p=JSON.parse(fs.readFileSync("package.json","utf8"));delete p.devDependencies;fs.writeFileSync("package.json",JSON.stringify(p))' \
  && pnpm install --prod

COPY src ./src

ENV TESSDATA_PATH=/app/tessdata
USER node
EXPOSE 8080
CMD ["node", "src/server.ts"]
