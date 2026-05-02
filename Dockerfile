FROM node:20-slim

# Install bun + openssl
RUN apt-get update && apt-get install -y openssl curl python3 make g++ unzip && \
    curl -fsSL https://bun.sh/install | bash && \
    ln -s /root/.bun/bin/bun /usr/local/bin/bun && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy ONLY package.json — NOT bun.lock — so bun resolves Next.js 15 fresh
COPY package.json ./

# Fresh install without lock file — picks up ~15.3.3 from package.json
RUN bun install --ignore-scripts --no-cache

# Copy rest of source
COPY . .

# DATABASE_URL placeholder for build time — real value injected at runtime
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

# Generate Prisma client (only needs schema, not a real DB connection)
RUN bun x prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
RUN ./node_modules/.bin/next build

EXPOSE 3000
ENV PORT=3000

# Clear placeholder — Railway injects the real DATABASE_URL at runtime
CMD ["sh", "-c", "bun x prisma db push && node server.js"]
