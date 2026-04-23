# ── Frontend — producción (multi-stage) ────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build args para variables de entorno en tiempo de build
ARG VITE_API_URL=/api
ARG VITE_AUTH_MODE=local

ENV VITE_API_URL=$VITE_API_URL \
    VITE_AUTH_MODE=$VITE_AUTH_MODE

RUN npm run build

# ── Nginx para servir el SPA ────────────────────────────────
FROM nginx:1.25-alpine AS runner

# Configuración nginx con proxy al backend y soporte SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
