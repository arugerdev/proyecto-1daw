# Stage 1: Build
FROM node:24.13.1-alpine3.22 AS build

WORKDIR /usr/src/app

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Stage 2: Production
FROM node:24.13.1-alpine3.22

WORKDIR /usr/src/app

# Instalar pm2 para gestión de procesos en producción
RUN npm install -g pm2

# Crear usuario no root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Crear directorios para uploads y logs
RUN mkdir -p /usr/src/app/uploads && \
    mkdir -p /usr/src/app/logs && \
    chown -R nodejs:nodejs /usr/src/app

# Copiar dependencias de producción desde stage build
COPY --from=build --chown=nodejs:nodejs /usr/src/app/node_modules ./node_modules

# Copiar código de la aplicación
COPY --chown=nodejs:nodejs . .

# Cambiar al usuario no root
USER nodejs

# Exponer puerto
EXPOSE 3000

# Iniciar aplicación con pm2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]