FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=${VITE_API_URL}

COPY package.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/backend/package.json apps/backend/package.json
RUN npm install

COPY . .
RUN npm run build -w @falconarena/frontend

FROM nginx:1.27-alpine AS runner
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
COPY --from=build /app/apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
