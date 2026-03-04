FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm install

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run prisma:generate -w @falconarena/backend
RUN npm run build -w @falconarena/backend

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV PRISMA_SCHEMA_PATH=apps/backend/prisma/schema.prisma
ENV PRISMA_SYNC_MODE=dbpush

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=build /app/apps/backend/prisma ./apps/backend/prisma

EXPOSE 4000
CMD ["sh", "-c", "npx prisma generate --schema \"$PRISMA_SCHEMA_PATH\" && if [ \"$PRISMA_SYNC_MODE\" = \"migrate\" ]; then npx prisma migrate deploy --schema \"$PRISMA_SCHEMA_PATH\"; else npx prisma db push --schema \"$PRISMA_SCHEMA_PATH\"; fi && node apps/backend/dist/main.js"]
