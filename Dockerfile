# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build -- --configuration production

# Serve stage
FROM nginx:alpine
# ✅ Clave: archivos en subcarpeta finanzas
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html/finanzas
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]