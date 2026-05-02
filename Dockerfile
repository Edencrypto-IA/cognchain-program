FROM node:20-slim

# Install bun + openssl
RUN apt-get update && apt-get install -y openssl curl python3 make g++ unzip && \
    curl -fsSL https://bun.sh/install | bash && \
    ln -s /root/.bun/bin/bun /usr/local/bin/bun && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cache bust — increment to force fresh bun install (used after Next.js downgrade)
ARG CACHEBUST=2

# Install dependencies (no frozen-lockfile — Next.js version changed)
COPY package.json bun.lock ./
RUN bun install --ignore-scripts

# Copy source
COPY . .

# Generate Prisma client
RUN bun x prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
RUN ./node_modules/.bin/next build

EXPOSE 3000
ENV PORT=3000

CMD ["sh", "-c", "bun x prisma db push && node server.js"]
