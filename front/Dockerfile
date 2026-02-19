# Stage 1: Build
FROM node:24.13.1-alpine3.22 AS build

WORKDIR /usr/src/app

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar todos los archivos
COPY . .

# Mostrar información para depuración
RUN echo "=== Directorio actual ===" && \
    pwd && \
    echo "=== Contenido ===" && \
    ls -la && \
    echo "=== package.json ===" && \
    cat package.json

# Ejecutar build
RUN npm run build -- --configuration=production || \
    npm run build -- --configuration=production --budget-warnings=false || \
    npm run build -- --configuration=development

# Mostrar estructura después del build
RUN echo "=== Estructura de dist después del build ===" && \
    ls -la dist/ && \
    echo "=== Contenido de dist/front (si existe) ===" && \
    ls -la dist/front/ 2>/dev/null || echo "dist/front no existe" && \
    echo "=== Buscando carpeta browser ===" && \
    find dist -name "browser" -type d | head -5

# Copiar el contenido de browser a /tmp/nginx-html
# La estructura puede ser dist/front/browser o dist/browser
RUN if [ -d "dist/front/browser" ]; then \
        echo "✅ Encontrado: dist/front/browser" && \
        cp -r dist/front/browser/* /tmp/nginx-html/; \
    elif [ -d "dist/browser" ]; then \
        echo "✅ Encontrado: dist/browser" && \
        cp -r dist/browser/* /tmp/nginx-html/; \
    elif [ -d "dist/ang-dockerized-app/browser" ]; then \
        echo "✅ Encontrado: dist/ang-dockerized-app/browser" && \
        cp -r dist/ang-dockerized-app/browser/* /tmp/nginx-html/; \
    else \
        echo "⚠️  No se encontró carpeta browser, copiando todo dist/" && \
        mkdir -p /tmp/nginx-html && \
        cp -r dist/* /tmp/nginx-html/ 2>/dev/null || true; \
    fi

# Verificar contenido copiado
RUN echo "=== Contenido de /tmp/nginx-html ===" && \
    ls -la /tmp/nginx-html/ && \
    echo "=== Archivos importantes ===" && \
    find /tmp/nginx-html -name "index.html" | head -5

# Stage 2: Nginx
FROM nginx:1.17.1-alpine

# Instalar herramientas útiles para depuración
RUN apk add --no-cache curl

# Crear directorio para la aplicación
RUN mkdir -p /usr/share/nginx/html

# Copiar configuración de Nginx
COPY nginx.conf /etc/nginx/nginx.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar los archivos build desde la ubicación temporal
COPY --from=build /tmp/nginx-html /usr/share/nginx/html

# Establecer permisos correctos
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Verificar que se copió correctamente
RUN echo "=== Contenido final de nginx html ===" && \
    ls -la /usr/share/nginx/html/ && \
    if [ ! -f /usr/share/nginx/html/index.html ]; then \
        echo "ERROR: No se encontró index.html" && \
        echo "Buscando index.html en todo el sistema..." && \
        find /usr/share/nginx/html -name "index.html" || true; \
        exit 1; \
    else \
        echo "✅ index.html encontrado correctamente en /usr/share/nginx/html/index.html"; \
    fi

EXPOSE 80

# Iniciar Nginx en primer plano
CMD ["nginx", "-g", "daemon off;"]