<div align="center">

# 📺 Television Écija — Media Manager

**Sistema centralizado de gestión de contenido multimedia para la televisión local de Écija.**

[![TypeScript](https://img.shields.io/badge/TypeScript-41%25-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Angular](https://img.shields.io/badge/Angular-Frontend-DD0031?style=flat-square&logo=angular&logoColor=white)](https://angular.io/)
[![Node.js](https://img.shields.io/badge/Node.js-Express%20API-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-Database-4479A1?style=flat-square&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)

</div>

---

## 📖 Descripción

Television Écija gestiona vídeos, fotos y contenido multimedia almacenado de forma distribuida en distintos equipos y discos duros. Este software centraliza, organiza y permite administrar todo ese contenido desde una única aplicación web interna, ofreciendo búsquedas avanzadas, filtros, categorización y control de acceso por roles.

---

## ✨ Características principales

| Funcionalidad | Descripción |
|---|---|
| 📁 **Gestión multimedia** | Subida, almacenamiento y visualización de vídeos e imágenes |
| 🔍 **Búsqueda avanzada** | Panel de búsqueda con filtros globales e individuales |
| 🗂️ **Categorización** | Organización y ordenación por relevancia/ambigüedad |
| 🔐 **Control de acceso** | Login con roles diferenciados (administrador / visualizador) |
| 👤 **Gestión de usuarios** | Creación, edición y borrado de cuentas |
| 🌐 **Red local** | Aplicación desplegable en intranet corporativa |
| 🐳 **Contenedores Docker** | Despliegue aislado y reproducible con persistencia de datos |

---

## 🏗️ Arquitectura del proyecto

```
proyecto-1daw/
├── api/                   # Backend — API REST con Express + Node.js
├── front/                 # Frontend — Aplicación Angular
├── db/                    # Scripts y configuración inicial de base de datos
├── mysql/
│   └── backups/           # Copias de seguridad de MySQL
├── utils/                 # Scripts auxiliares (Shell / Batch)
├── docker-compose.yml     # Orquestación de contenedores
└── package-lock.json
```

El sistema sigue una arquitectura en tres capas desacopladas:

```
┌─────────────────┐        HTTP/REST        ┌─────────────────┐        SQL        ┌─────────────────┐
│                 │  ──────────────────────► │                 │  ───────────────► │                 │
│  Angular Front  │                          │  Express API    │                   │    MySQL DB     │
│   (Puerto 4200) │  ◄──────────────────────  │  (Puerto 3000)  │  ◄───────────────  │  (Puerto 3306)  │
│                 │        JSON Response     │                 │     ResultSet     │                 │
└─────────────────┘                          └─────────────────┘                   └─────────────────┘
```

---

## 🛠️ Tecnologías utilizadas

### Frontend
- **Angular** — Framework SPA para la interfaz de usuario
- **TypeScript** — Lenguaje principal del frontend
- **HTML5 / CSS3** — Maquetación y estilos

### Backend
- **Node.js** — Entorno de ejecución JavaScript en servidor
- **Express.js** — Framework para construir la API REST
- **JavaScript / TypeScript** — Lógica de negocio del servidor

### Base de datos
- **MySQL** — Motor de base de datos relacional
- **SQL** — Scripts de inicialización y backups

### DevOps / Infraestructura
- **Docker** — Contenedorización de servicios
- **Docker Compose** — Orquestación multi-contenedor
- **Shell / Batch scripts** — Automatización de tareas

---

## ⚙️ Configuración

Antes de arrancar, asegúrate de tener las siguientes variables de entorno definidas. Puedes crear un archivo `.env` en la raíz del proyecto:

```env
# ── Base de datos ──────────────────────────────────────
DB_HOST=mysql
DB_PORT=3306
DB_NAME=television_ecija
DB_USER=root
DB_PASSWORD=tu_contraseña_segura

# ── API ────────────────────────────────────────────────
API_PORT=3000
JWT_SECRET=tu_clave_secreta_jwt
JWT_EXPIRES_IN=24h

# ── Almacenamiento ─────────────────────────────────────
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=500mb
```

> ⚠️ **Nunca subas el archivo `.env` al repositorio.** Ya está incluido en `.gitignore`.

---

## 🚀 Instalación y puesta en marcha

### Prerrequisitos

- [Docker](https://www.docker.com/get-started) ≥ 24.x
- [Docker Compose](https://docs.docker.com/compose/) ≥ 2.x
- [Node.js](https://nodejs.org/) ≥ 18.x *(solo para desarrollo local sin Docker)*
- [Angular CLI](https://angular.io/cli) ≥ 17.x *(solo para desarrollo local)*

---

### 🐳 Opción 1 — Con Docker (Recomendado)

```bash
# 1. Clona el repositorio
git clone https://github.com/arugerdev/proyecto-1daw.git
cd proyecto-1daw

# 2. Copia y configura las variables de entorno
cp .env.example .env
# Edita .env con tus valores

# 3. Levanta todos los servicios
docker compose up -d

# 4. Verifica que los contenedores están corriendo
docker compose ps
```

Los servicios estarán disponibles en:

| Servicio | URL |
|---|---|
| Frontend Angular | http://localhost:4200 |
| API Express | http://localhost:3000 |
| MySQL | localhost:3306 |

Para detener los servicios:
```bash
docker compose down
```

Para detener y eliminar volúmenes (⚠️ borra los datos):
```bash
docker compose down -v
```

---

### 💻 Opción 2 — Desarrollo local (sin Docker)

#### API (Backend)

```bash
cd api
npm install
npm run dev        # Modo desarrollo con hot-reload
# o
npm start          # Modo producción
```

#### Frontend

```bash
cd front
npm install
ng serve           # Servidor de desarrollo en http://localhost:4200
# o
ng build           # Build de producción en dist/
```

#### Base de datos

Importa el esquema inicial desde la carpeta `db/`:

```bash
mysql -u root -p < db/schema.sql
```

---

## 🔑 Roles y acceso

El sistema implementa dos niveles de acceso:

| Rol | Permisos |
|---|---|
| **Administrador** | Acceso total: subir, editar, borrar contenido y gestionar usuarios |
| **Visualizador** | Solo lectura: navegar, buscar y visualizar el contenido |

El registro público crea usuarios con rol **Visualizador** por defecto. Los administradores pueden ascender roles desde el panel de gestión de usuarios.

---

## 📂 Estructura de la API

La API sigue convenciones REST. Endpoints principales:

```
POST   /auth/login             — Autenticación y obtención de token JWT
POST   /auth/register          — Registro de nuevo usuario

GET    /media                  — Listar contenido (con filtros y paginación)
POST   /media/upload           — Subir nuevo archivo multimedia
GET    /media/:id              — Obtener detalle de un recurso
PUT    /media/:id              — Editar metadatos de un recurso
DELETE /media/:id              — Eliminar un recurso

GET    /users                  — Listar usuarios (solo Admin)
POST   /users                  — Crear usuario (solo Admin)
PUT    /users/:id              — Editar usuario (solo Admin)
DELETE /users/:id              — Borrar usuario (solo Admin)
```

---

## 🗄️ Base de datos

El esquema principal incluye las siguientes entidades:

```
users          — Cuentas de usuario y roles
media_files    — Registro de archivos multimedia (vídeo, imagen, etc.)
categories     — Categorías para clasificar el contenido
tags           — Etiquetas libres asociadas a cada recurso
```

Los backups automáticos se almacenan en `mysql/backups/`.

---

## 🐳 Docker — Detalle de contenedores

El archivo `docker-compose.yml` define tres servicios independientes:

```yaml
services:
  frontend:    # Angular — puerto 4200
  api:         # Express/Node.js — puerto 3000
  db:          # MySQL — puerto 3306

volumes:
  mysql_data:  # Volumen persistente para los datos de MySQL
  uploads:     # Volumen persistente para los archivos multimedia subidos
```

Los volúmenes garantizan que los datos **no se pierden** al reiniciar o actualizar los contenedores.

---

## 🔍 Funcionalidades de búsqueda y filtrado

La aplicación ofrece un panel de búsqueda con las siguientes capacidades:

- **Búsqueda por texto libre** sobre títulos, descripciones y etiquetas
- **Filtros individuales**: por tipo de archivo (vídeo/imagen), categoría, fecha, autor
- **Filtro global combinado**: aplica múltiples criterios simultáneamente
- **Ordenación**: por fecha, nombre, relevancia o criterio de ambigüedad
- **Paginación** de resultados para grandes colecciones

---

## 📜 Scripts útiles

```bash
# Levantar entorno completo
docker compose up -d

# Ver logs en tiempo real
docker compose logs -f

# Reconstruir imagen tras cambios
docker compose up --build

# Acceder a la shell del contenedor de la API
docker compose exec api sh

# Hacer backup manual de MySQL
docker compose exec db mysqldump -u root -p television_ecija > mysql/backups/backup_$(date +%F).sql
```

---

## 📋 Requisitos del sistema (producción)

| Componente | Mínimo recomendado |
|---|---|
| CPU | 2 núcleos |
| RAM | 4 GB |
| Almacenamiento | 50 GB (más según volumen de vídeo) |
| Red | LAN 100 Mbps |
| SO | Linux (Ubuntu 22.04+) / Windows Server |

---

## 🤝 Contribución

1. Haz un fork del repositorio
2. Crea tu rama: `git checkout -b feature/nueva-funcionalidad`
3. Realiza tus cambios y haz commit: `git commit -m 'feat: añade nueva funcionalidad'`
4. Sube la rama: `git push origin feature/nueva-funcionalidad`
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto ha sido desarrollado como proyecto de fin de curso del **primer año de DAW (Desarrollo de Aplicaciones Web)**.

---

<div align="center">

Desarrollado con ❤️ por [arugerdev](https://github.com/arugerdev), [Heihachic](https://github.com/Heihachic) y [Paikuan144](https://github.com/Paikuan144)

</div>
