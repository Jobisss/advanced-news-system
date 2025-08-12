FROM oven/bun:latest AS deps
WORKDIR /app

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package.json bun.lock ./
RUN bun install 

RUN ./node_modules/.bin/playwright install chromium

FROM oven/bun:latest AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk-bridge2.0-0 libxkbcommon0 libdrm2 libxcomposite1 \
    libxrandr2 libxdamage1 libxfixes3 libasound2 libpangocairo-1.0-0 \
    libpango-1.0-0 libgtk-3-0 libcups2 libdbus-1-3 libgbm1 \
    ca-certificates fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /ms-playwright /ms-playwright

COPY . .

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD bun -e "console.log('ok')" >/dev/null 2>&1 || exit 1

CMD ["bun", "run", "start"]
