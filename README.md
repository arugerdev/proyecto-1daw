# EcijaComarca Media Manager

Sistema de gestión de contenido multimedia para televisión local. Permite catalogar, buscar, subir y reproducir vídeos, audios, imágenes y documentos con soporte para archivos de hasta 50 GB.

---

## Índice

1. [Requisitos](#1-requisitos)
2. [Instalación rápida](#2-instalación-rápida)
   - [Windows (recomendado)](#windows-recomendado)
   - [Linux / macOS](#linux--macos)
3. [Instalación manual](#3-instalación-manual)
4. [Variables de entorno](#4-variables-de-entorno)
5. [Gestión del servicio](#5-gestión-del-servicio)
6. [Sistema de actualizaciones](#6-sistema-de-actualizaciones)
7. [Arquitectura](#7-arquitectura)
8. [API Reference](#8-api-reference)
9. [Roles y permisos](#9-roles-y-permisos)
10. [Producción y recomendaciones](#10-producción-y-recomendaciones)

---

## 1. Requisitos

| Componente | Versión mínima | Notas |
|---|---|---|
| Node.js | 20 LTS | Los scripts de setup lo instalan automáticamente |
| MySQL / MariaDB | 10.6 / 8.0 | Los scripts lo instalan automáticamente |
| Sistema operativo | Windows 10+ / Ubuntu 20.04+ / Debian 11+ / RHEL 8+ / macOS 12+ | |
| RAM | 1 GB mínimo | 2 GB+ recomendado para builds de Angular |
| Disco | Espacio suficiente para los medios | Los vídeos pueden ser de 50 GB o más |

---

## 2. Instalación rápida

### Windows (recomendado)

Abre **PowerShell como Administrador** y ejecuta:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
cd C:\ruta\al\proyecto
.\setup.ps1
```

El script:
- Instala Node.js LTS y MariaDB vía **winget** si no están disponibles
- Te pregunta la configuración (host DB, contraseñas, puerto, ruta de medios…)
- Crea `api/.env` con una `SECRET_KEY` aleatoria
- Instala dependencias npm y compila el frontend Angular
- Configura la base de datos y crea los usuarios iniciales
- Registra una **Tarea Programada de Windows** para auto-inicio con el sistema

**Parámetros opcionales:**

```powershell
.\setup.ps1 -SkipBuild    # Omite la compilación Angular (API-only o ya compilado)
.\setup.ps1 -SkipService  # No registra la tarea programada
.\setup.ps1 -Unattended   # Sin preguntas, todo por defecto (para CI)
```

**Gestión del servicio en Windows:**

```powershell
Start-ScheduledTask -TaskName "EcijaComarca_API"
Stop-ScheduledTask  -TaskName "EcijaComarca_API"
Get-ScheduledTask   -TaskName "EcijaComarca_API" | Get-ScheduledTaskInfo
```

---

### Linux / macOS

Ejecuta como **root** (o con `sudo`) desde el directorio del proyecto:

```bash
chmod +x setup.sh
sudo ./setup.sh
```

El script detecta el sistema operativo (Debian/Ubuntu, RHEL/CentOS, Fedora, macOS) y usa el gestor de paquetes adecuado (`apt`, `dnf`, `yum`, `brew`) para instalar Node.js y MariaDB.

Al finalizar crea un servicio **systemd** (Linux) o **launchd** (macOS) para auto-inicio.

**Parámetros opcionales:**

```bash
sudo ./setup.sh --skip-build    # Omite la compilación Angular
sudo ./setup.sh --skip-service  # No crea el servicio systemd/launchd
sudo ./setup.sh --unattended    # Sin preguntas, todo por defecto
```

**Gestión del servicio en Linux:**

```bash
systemctl status  ecijacomarca
systemctl restart ecijacomarca
systemctl stop    ecijacomarca
journalctl -u ecijacomarca -f     # Logs en tiempo real
```

---

## 3. Instalación manual

Si prefieres instalar paso a paso o ya tienes Node.js y MySQL:

### 3.1 Base de datos

```sql
-- Conéctate como root
CREATE DATABASE ecijacomarca CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ecijacomarca_user'@'localhost' IDENTIFIED BY 'tu_contraseña';
GRANT ALL PRIVILEGES ON ecijacomarca.* TO 'ecijacomarca_user'@'localhost';
FLUSH PRIVILEGES;
```

Aplica el esquema:

```bash
mysql -u root -p ecijacomarca < db/schema.sql
```

Crea los usuarios iniciales (requiere que `api/node_modules` ya esté instalado):

```bash
cd api && npm install
node -e "
const bcrypt = require('bcryptjs');
bcrypt.hash('tu_contraseña', 12).then(h => {
  console.log('INSERT INTO users (username,password,role) VALUES (\'admin\',\''+h+'\',\'admin\');');
});
"
# Ejecuta el INSERT resultante en MySQL
```

### 3.2 Configuración de la API

Copia el ejemplo y edita los valores:

```bash
cp api/.env.example api/.env
# Edita api/.env con tu editor favorito
```

Ver [Variables de entorno](#4-variables-de-entorno) para el detalle de cada campo.

### 3.3 Dependencias e inicio

```bash
# API
cd api
npm install
node main.js

# Frontend (en otra terminal o máquina)
cd front
npm install
npm run build -- --configuration=production
# Sirve front/dist/front/browser/ con nginx, IIS o cualquier servidor estático
```

---

## 4. Variables de entorno

Fichero: `api/.env`

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `HOST` | `localhost` | Host del servidor MySQL |
| `USER` | `ecijacomarca_user` | Usuario de la base de datos |
| `PASSWORD` | *(obligatorio)* | Contraseña del usuario de la BD |
| `DATABASE` | `ecijacomarca` | Nombre de la base de datos |
| `SECRET_KEY` | *(obligatorio)* | Clave para firmar los JWT. Genera con: `node -e "console.log(require('crypto').randomBytes(64).toString('base64url'))"` |
| `MEDIA_PATH` | `C:\EcijaComarca\Media` | Directorio donde se almacenan los archivos subidos |
| `MAX_FILE_SIZE` | `53687091200` | Tamaño máximo de subida en bytes (por defecto 50 GB) |
| `PORT` | `3000` | Puerto en que escucha la API |
| `NODE_ENV` | `production` | Entorno (`production` / `development`) |
| `UPDATE_MANIFEST_URL` | *(vacío)* | URL del manifiesto JSON para actualizaciones remotas (opcional) |

---

## 5. Gestión del servicio

### Windows — Tarea Programada

La tarea se llama `EcijaComarca_API` y se configura con cuenta SYSTEM, arranque automático y 10 reintentos ante fallos.

```powershell
# Iniciar
Start-ScheduledTask -TaskName "EcijaComarca_API"

# Detener
Stop-ScheduledTask -TaskName "EcijaComarca_API"

# Ver estado y última ejecución
Get-ScheduledTask -TaskName "EcijaComarca_API" | Get-ScheduledTaskInfo

# Desregistrar
Unregister-ScheduledTask -TaskName "EcijaComarca_API" -Confirm:$false
```

Los logs se escriben en `logs/api.log` y `logs/api.error.log`.

### Linux — systemd

```bash
systemctl status   ecijacomarca   # Estado actual
systemctl start    ecijacomarca   # Iniciar
systemctl stop     ecijacomarca   # Detener
systemctl restart  ecijacomarca   # Reiniciar
systemctl enable   ecijacomarca   # Habilitar auto-inicio
systemctl disable  ecijacomarca   # Deshabilitar auto-inicio

journalctl -u ecijacomarca -f            # Seguir logs en tiempo real
journalctl -u ecijacomarca --since today # Logs de hoy
```

---

## 6. Sistema de actualizaciones

El sistema **no usa git** en producción. Las actualizaciones se distribuyen como paquetes ZIP que contienen solo los archivos modificados.

### Crear un paquete de actualización

Un paquete es un `.zip` con los archivos que han cambiado respecto a la versión anterior:

```
release-2.1.0.zip
├── api/
│   └── src/
│       └── routes/
│           └── media.routes.js   ← archivo modificado
├── front/
│   └── dist/
│       └── front/
│           └── browser/          ← frontend recompilado
└── version.json                  ← {"version":"2.1.0"}
```

**Archivos protegidos** — nunca se sobreescriben aunque estén en el ZIP:
- `api/.env`
- `api/node_modules/`
- `logs/`
- `uploads/`
- `thumbnails/`
- `updates/`

> El `version.json` del paquete sí se aplica — es el que indica la versión instalada tras la actualización.

### Aplicar una actualización

**Opción A — Panel de administración (recomendado):**

1. Ve a `Dashboard → Sistema`
2. Sube el `.zip` con el botón "Subir paquete"
3. Haz clic en "Instalar" junto al paquete deseado
4. El servidor se reinicia automáticamente en ~3 segundos

**Opción B — Carpeta `updates/`:**

Copia el `.zip` directamente a la carpeta `updates/` del servidor. Aparecerá en la lista del panel en la próxima carga de la página.

**Opción C — Actualización remota automática:**

Configura `UPDATE_MANIFEST_URL` en `api/.env` con la URL de un fichero JSON:

```json
{
  "version": "2.1.0",
  "changes": ["Mejoras en el buscador", "Fix en subida de vídeos"],
  "download": "https://tu-servidor.com/releases/release-2.1.0.zip",
  "filename": "release-2.1.0.zip"
}
```

El panel mostrará automáticamente la actualización disponible con botón de descarga e instalación.

---

## 7. Arquitectura

```
Servidor/
├── api/                    # Backend Node.js + Express
│   ├── main.js             # Punto de entrada — servidor HTTP y rutas
│   ├── src/
│   │   ├── config/         # multer (subidas), pool MySQL
│   │   ├── controllers/    # Lógica de negocio por dominio
│   │   ├── middleware/     # Auth JWT, manejo de errores
│   │   ├── routes/         # Definición de rutas HTTP
│   │   ├── services/       # update.service.js, etc.
│   │   └── utils/          # Helpers (thumbnails, ffmpeg…)
│   ├── .env                # Variables de entorno (NO en git)
│   └── .env.example        # Plantilla de configuración
│
├── front/                  # Frontend Angular 21
│   ├── src/
│   │   ├── app/
│   │   │   ├── index/      # Página principal — explorador de medios
│   │   │   ├── dashboard/  # Panel de administración
│   │   │   ├── media/      # Vista de detalle de un archivo
│   │   │   └── modals/     # Modales (upload, edit-media)
│   │   ├── components/     # Componentes reutilizables
│   │   └── services/       # auth.service, file.service
│   └── dist/front/browser/ # Build de producción (sirve con nginx/IIS)
│
├── db/
│   └── schema.sql          # Esquema completo para instalación limpia
│
├── logs/                   # Logs de la API (se crean automáticamente)
├── updates/                # Paquetes ZIP de actualización
├── version.json            # Versión actualmente instalada
├── setup.ps1               # Setup automático Windows
└── setup.sh                # Setup automático Linux / macOS
```

### Flujo de una petición

```
Navegador
  └─► Angular SPA (front/dist) — servido por nginx / IIS
        └─► /api/* → proxy → API Express (puerto 3000)
              ├─► Middleware JWT — verifica sesión
              ├─► Controller — lógica de negocio
              └─► MySQL pool — base de datos
```

### Base de datos — tablas principales

| Tabla | Descripción |
|---|---|
| `users` | Cuentas de usuario con roles |
| `sessions` | Tokens JWT activos |
| `media_items` | Ficheros multimedia catalogados |
| `categories` | Categorías (soporta jerarquía padre/hijo) |
| `tags` | Etiquetas libres |
| `storage_locations` | Directorios o rutas de almacenamiento |
| `media_tags` | Relación N:M media ↔ tags |
| `media_authors` | Relación N:M media ↔ usuarios autores |

---

## 8. API Reference

Base URL: `http://localhost:3000/api`

Todas las rutas protegidas requieren la cabecera:
```
Authorization: Bearer <token>
```

### Autenticación

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/auth/login` | Login — devuelve `{ token, user }` |
| `POST` | `/auth/logout` | Cierra la sesión actual |
| `GET` | `/auth/me` | Perfil del usuario autenticado |

### Media

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/media` | Listar archivos (paginado, filtrable) |
| `GET` | `/media/:id` | Detalle de un archivo |
| `POST` | `/media/upload` | Subir un archivo (`multipart/form-data`) |
| `PUT` | `/media/:id` | Editar metadatos |
| `DELETE` | `/media/:id` | Eliminar archivo |
| `GET` | `/media/:id/stream` | Streaming con soporte de cabecera `Range` |
| `GET` | `/media/:id/thumbnail` | Miniatura del archivo |
| `GET` | `/media/:id/download` | Descarga directa |

**Parámetros de `GET /media` (query string):**

| Parámetro | Tipo | Descripción |
|---|---|---|
| `q` | string | Búsqueda fulltext en título y descripción |
| `category_id` | int | Filtrar por categoría |
| `tag` | string | Filtrar por etiqueta |
| `kind` | string | `video`, `audio`, `image`, `document`, `text`, `other` |
| `year` | int | Año de publicación |
| `location_id` | int | Filtrar por ubicación |
| `page` | int | Página (default: 1) |
| `limit` | int | Resultados por página (default: 50) |
| `sort` | string | Campo de ordenación (`created_at`, `title`, `file_size`…) |
| `order` | string | `asc` / `desc` |

### Usuarios

| Método | Ruta | Descripción | Rol mínimo |
|---|---|---|---|
| `GET` | `/users` | Listar usuarios | admin |
| `POST` | `/users` | Crear usuario | admin |
| `PUT` | `/users/:id` | Editar usuario | admin |
| `DELETE` | `/users/:id` | Eliminar usuario | owner |

### Categorías y Tags

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/categories` | Listar categorías |
| `POST` | `/categories` | Crear categoría |
| `PUT` | `/categories/:id` | Editar categoría |
| `DELETE` | `/categories/:id` | Eliminar categoría |
| `GET` | `/tags` | Listar etiquetas |
| `DELETE` | `/tags/:id` | Eliminar etiqueta |

### Ubicaciones de almacenamiento

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/locations` | Listar ubicaciones |
| `POST` | `/locations` | Crear ubicación |
| `DELETE` | `/locations/:id` | Eliminar ubicación |
| `GET` | `/locations/:id/browse` | Explorar el sistema de ficheros |

### Estadísticas y sistema

| Método | Ruta | Descripción | Rol mínimo |
|---|---|---|---|
| `GET` | `/stats` | Estadísticas generales (conteos, tamaño total…) | viewer |
| `GET` | `/update/packages` | Listar paquetes disponibles | owner |
| `POST` | `/update/upload` | Subir un paquete ZIP | owner |
| `POST` | `/update/download` | Descargar paquete desde URL remota | owner |
| `POST` | `/update/apply` | Aplicar paquete y reiniciar | owner |
| `GET` | `/health` | Health check (`{ status: "ok", uptime: N }`) | público |

---

## 9. Roles y permisos

| Permiso | owner | admin | moderator | viewer |
|---|:---:|:---:|:---:|:---:|
| Ver medios | ✔ | ✔ | ✔ | ✔ |
| Subir archivos | ✔ | ✔ | ✔ | ✗ |
| Editar metadatos | ✔ | ✔ | ✔ | ✗ |
| Eliminar archivos | ✔ | ✔ | ✗ | ✗ |
| Gestionar usuarios | ✔ | ✔ | ✗ | ✗ |
| Gestionar categorías | ✔ | ✔ | ✗ | ✗ |
| Gestionar ubicaciones | ✔ | ✔ | ✗ | ✗ |
| Aplicar actualizaciones | ✔ | ✗ | ✗ | ✗ |

El rol **owner** es el único que puede aplicar actualizaciones del sistema y eliminar otros administradores. Se crea durante la instalación y está oculto en la lista de usuarios por defecto (`is_hidden = true`).

---

## 10. Producción y recomendaciones

### Servir el frontend con nginx (Linux)

```nginx
server {
    listen 80;
    server_name tudominio.com;

    root /opt/ecijacomarca/front/dist/front/browser;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy a la API
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        # Timeouts amplios para subidas de archivos grandes
        proxy_read_timeout    43200s;
        proxy_send_timeout    43200s;
        client_max_body_size  55G;
    }
}
```

### Servir el frontend con IIS (Windows)

1. Crea un sitio apuntando a `front\dist\front\browser\`
2. Instala el módulo **URL Rewrite** de IIS
3. Crea una regla que redirija todas las peticiones sin archivo estático a `index.html`
4. Para la API, usa **Application Request Routing (ARR)** como proxy hacia `http://localhost:3000`
5. Aumenta el límite de tamaño en `web.config`: `<requestLimits maxAllowedContentLength="59055800320" />`

### Copias de seguridad

```bash
# Volcado de la base de datos
mysqldump -u root -p ecijacomarca > backup_$(date +%Y%m%d).sql

# Comprime los medios
tar -czf medios_$(date +%Y%m%d).tar.gz /opt/ecijacomarca/media
```

### Seguridad

- `api/.env` **nunca** debe entrar en control de versiones — ya está en `.gitignore`
- Usa una `SECRET_KEY` de al menos 64 bytes generada aleatoriamente
- Pon la API detrás de un proxy inverso (nginx/IIS) y **no expongas** el puerto 3000 directamente
- Configura un firewall que solo permita los puertos 80/443 desde el exterior
- Usa HTTPS con un certificado válido (Let's Encrypt con Certbot en Linux)

### Rotación de logs (Linux)

Crea `/etc/logrotate.d/ecijacomarca`:

```
/opt/ecijacomarca/logs/*.log {
    daily
    rotate 14
    compress
    missingok
    notifempty
    postrotate
        systemctl reload ecijacomarca 2>/dev/null || true
    endscript
}
```
