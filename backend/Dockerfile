FROM node:18-alpine
WORKDIR /app
COPY package.json ./
COPY packages ./packages
COPY prisma ./prisma
COPY src ./src
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --retries=3 CMD wget -qO- http://localhost:4000/api/v1/health || exit 1
CMD ["node", "src/server.mjs"]
