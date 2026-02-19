#!/bin/bash

echo "🚀 Iniciando despliegue de File Manager..."
echo "================================"


# Detener y eliminar contenedores existentes
echo "🛑 Deteniendo contenedores existentes..."
docker compose down -v 2>/dev/null

# Limpiar caché de build
echo "🧹 Limpiando caché de Docker..."
docker system prune -f 2>/dev/null

# Crear directorios necesarios
echo "📁 Creando directorios necesarios..."
mkdir -p ../db/backups
mkdir -p ../uploads

# Construir imágenes
echo "🏗️  Construyendo imágenes Docker..."
docker compose build --no-cache

# Iniciar servicios
echo "▶️  Iniciando servicios..."
docker compose up -d

# Esperar a que MySQL esté listo
echo "⏳ Esperando a que MySQL esté listo..."
sleep 20

# Verificar estado de los servicios
echo "📊 Estado de los servicios:"
docker compose ps

# Mostrar logs de MySQL si hay error
if [ $? -ne 0 ] || ! docker compose ps | grep -q "mysql.*Up"; then
    echo "❌ Error en MySQL. Mostrando logs:"
    docker compose logs mysql
else
    echo "✅ MySQL está funcionando correctamente"
fi

# Verificar API
if docker compose ps | grep -q "api.*Up"; then
    echo "✅ API está funcionando correctamente"
else
    echo "❌ Error en API. Mostrando logs:"
    docker compose logs api
fi

# Verificar Frontend
if docker compose ps | grep -q "frontend.*Up"; then
    echo "✅ Frontend está funcionando correctamente"
else
    echo "❌ Error en Frontend. Mostrando logs:"
    docker compose logs frontend
fi

echo ""
echo "📱 Aplicación disponible en:"
echo "   - Frontend: http://localhost"
echo "   - API: http://localhost:3000"
echo "   - MySQL: localhost:3307"
echo ""
echo "🔑 Credenciales por defecto:"
echo "   - Usuario: admin "
echo "   - Password: admin (si está configurado)"
echo ""
echo "📁 Volúmenes:"
echo "   - Base de datos: file_manager_mysql_data"
echo "   - Archivos subidos: file_manager_uploads_data"
echo ""

# Mostrar logs en tiempo real (opcional)
if [ "$1" = "--logs" ]; then
    echo "📋 Mostrando logs (Ctrl+C para salir)..."
    docker compose logs -f
fi