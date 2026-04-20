#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  EcijaComarca Media Manager — Linux / macOS Setup Script
#  Run once as root (or with sudo) from the project directory.
#
#  Usage:
#    chmod +x setup.sh
#    sudo ./setup.sh                     # interactive
#    sudo ./setup.sh --skip-build        # skip Angular build
#    sudo ./setup.sh --skip-service      # skip systemd service
#    sudo ./setup.sh --unattended        # all defaults, no prompts
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Flags ─────────────────────────────────────────────────────────────────────
SKIP_BUILD=false
SKIP_SERVICE=false
UNATTENDED=false
MODE="production"

for arg in "$@"; do
    case $arg in
        --skip-build)        SKIP_BUILD=true       ;;
        --skip-service)      SKIP_SERVICE=true      ;;
        --unattended)        UNATTENDED=true        ;;
        --mode=development)  MODE="development"     ;;
        --mode=production)   MODE="production"      ;;
        --development)       MODE="development"     ;;
    esac
done

# ── Script directory (project root) ───────────────────────────────────────────
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; GRAY='\033[0;90m'; WHITE='\033[1;37m'; RESET='\033[0m'

write_banner() {
    clear
    echo ""
    echo -e "${CYAN}  ╔══════════════════════════════════════════════════════╗${RESET}"
    echo -e "${CYAN}  ║      EcijaComarca Media Manager — Setup (Linux)      ║${RESET}"
    echo -e "${CYAN}  ╚══════════════════════════════════════════════════════╝${RESET}"
    echo ""
}

step()    { echo -e "${CYAN}  [$1] $2${RESET}"; }
ok()      { echo -e "${GREEN}  ✔  $1${RESET}"; }
warn()    { echo -e "${YELLOW}  ⚠  $1${RESET}"; }
fail()    { echo -e "${RED}  ✖  $1${RESET}"; }
info()    { echo -e "${GRAY}     $1${RESET}"; }

# ── Root check ────────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    fail "Este script debe ejecutarse como root."
    info "Usa: sudo ./setup.sh"
    exit 1
fi

# ── Detect OS / package manager ───────────────────────────────────────────────
detect_os() {
    if command -v apt-get &>/dev/null; then
        PKG_MGR="apt"
    elif command -v dnf &>/dev/null; then
        PKG_MGR="dnf"
    elif command -v yum &>/dev/null; then
        PKG_MGR="yum"
    elif command -v brew &>/dev/null; then
        PKG_MGR="brew"
    else
        PKG_MGR="unknown"
    fi
}

pkg_install() {
    local pkg="$1"
    info "Instalando $pkg..."
    case $PKG_MGR in
        apt)  apt-get install -y "$pkg" &>/dev/null ;;
        dnf)  dnf install -y "$pkg" &>/dev/null     ;;
        yum)  yum install -y "$pkg" &>/dev/null     ;;
        brew) brew install "$pkg" &>/dev/null        ;;
        *)    fail "Gestor de paquetes no soportado. Instala $pkg manualmente."; exit 1 ;;
    esac
}

# ── Prompt helpers ────────────────────────────────────────────────────────────
read_cfg() {
    local prompt="$1"
    local default="${2:-}"
    if [[ "$UNATTENDED" == "true" ]]; then
        echo "$default"
        return
    fi
    local hint=""
    [[ -n "$default" ]] && hint=" [$default]"
    local value
    read -rp "  → $prompt$hint: " value
    echo "${value:-$default}"
}

read_secret() {
    local prompt="$1"
    local default="${2:-}"
    if [[ "$UNATTENDED" == "true" ]]; then
        echo "$default"
        return
    fi
    local hint=""
    [[ -n "$default" ]] && hint=" [dejar vacío = usa valor por defecto]"
    local value
    read -rsp "  → $prompt$hint: " value
    echo ""
    echo "${value:-$default}"
}

# ── Random secret ─────────────────────────────────────────────────────────────
new_secret() {
    local bytes="${1:-64}"
    openssl rand -base64 "$bytes" | tr -d '\n='
}

# ── MySQL helpers ─────────────────────────────────────────────────────────────
# Creates a temp CNF file so the password is never exposed on the command line
# (avoids the "Warning: Using a password on the command line..." message).
_mysql_cnf() {
    local pass="$1"
    local cnf
    cnf=$(mktemp)
    chmod 600 "$cnf"
    printf '[client]\npassword=%s\n' "$pass" > "$cnf"
    echo "$cnf"
}

mysql_exec() {
    local sql="$1"
    local user="${2:-root}"
    local pass="${3:-}"
    local host="${4:-localhost}"
    local args=(-u "$user" -h "$host" --batch --silent -e "$sql")
    local cnf=""
    if [[ -n "$pass" ]]; then
        cnf=$(_mysql_cnf "$pass")
        args=("--defaults-extra-file=$cnf" "${args[@]}")
    fi
    mysql "${args[@]}"
    local ec=$?
    [[ -n "$cnf" ]] && rm -f "$cnf"
    return $ec
}

mysql_exec_file() {
    local file="$1"
    local user="${2:-root}"
    local pass="${3:-}"
    local host="${4:-localhost}"
    local database="${5:-}"
    local args=(-u "$user" -h "$host" --batch --silent)
    local cnf=""
    if [[ -n "$pass" ]]; then
        cnf=$(_mysql_cnf "$pass")
        args=("--defaults-extra-file=$cnf" "${args[@]}")
    fi
    [[ -n "$database" ]] && args+=("--database=$database")
    mysql "${args[@]}" < "$file"
    local ec=$?
    [[ -n "$cnf" ]] && rm -f "$cnf"
    return $ec
}

# ═════════════════════════════════════════════════════════════════════════════
write_banner
detect_os
info "Sistema detectado — gestor de paquetes: $PKG_MGR"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 1 — Node.js
# ══════════════════════════════════════════════════════════════════════════════
step "1/7" "Verificando Node.js..."

if ! command -v node &>/dev/null; then
    warn "Node.js no encontrado. Instalando..."
    case $PKG_MGR in
        apt)
            # NodeSource repo for LTS
            curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - &>/dev/null
            apt-get install -y nodejs &>/dev/null
            ;;
        dnf|yum)
            curl -fsSL https://rpm.nodesource.com/setup_lts.x | bash - &>/dev/null
            ${PKG_MGR} install -y nodejs &>/dev/null
            ;;
        brew)
            brew install node &>/dev/null
            ;;
        *)
            fail "Instala Node.js LTS desde https://nodejs.org y vuelve a ejecutar el script."
            exit 1
            ;;
    esac
fi

if ! command -v node &>/dev/null; then
    fail "Node.js sigue sin estar disponible tras la instalación."
    exit 1
fi

NODE_VER=$(node --version)
NPM_VER=$(npm --version)
ok "Node.js $NODE_VER"
ok "npm $NPM_VER"

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 2 — MySQL / MariaDB
# ══════════════════════════════════════════════════════════════════════════════
step "2/7" "Verificando MySQL / MariaDB..."

if ! command -v mysql &>/dev/null; then
    warn "mysql no encontrado. Instalando MariaDB..."
    case $PKG_MGR in
        apt)
            apt-get install -y mariadb-server &>/dev/null
            systemctl enable --now mariadb &>/dev/null || true
            ;;
        dnf)
            dnf install -y mariadb-server &>/dev/null
            systemctl enable --now mariadb &>/dev/null || true
            ;;
        yum)
            yum install -y mariadb-server &>/dev/null
            systemctl enable --now mariadb &>/dev/null || true
            ;;
        brew)
            brew install mariadb &>/dev/null
            brew services start mariadb &>/dev/null || true
            ;;
        *)
            fail "Instala MariaDB o MySQL manualmente y vuelve a ejecutar el script."
            exit 1
            ;;
    esac
fi

if ! command -v mysql &>/dev/null; then
    fail "mysql sigue sin estar disponible."
    info "Descarga MariaDB: https://mariadb.org/download"
    exit 1
fi

MYSQL_VER=$(mysql --version)
ok "MySQL/MariaDB: $MYSQL_VER"

# Ensure unzip is available (needed for update packages)
if ! command -v unzip &>/dev/null; then
    pkg_install unzip
fi
ok "unzip disponible"

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 3 — Configuration
# ══════════════════════════════════════════════════════════════════════════════
step "3/7" "Configuración..."
echo ""
echo -e "${GRAY}  Responde las siguientes preguntas. Pulsa ENTER para usar el valor por defecto.${RESET}"
echo ""

# Database
DB_HOST=$(read_cfg   "Host MySQL"                  "localhost")
DB_PORT=$(read_cfg   "Puerto MySQL"                "3306")
DB_ROOT=$(read_secret "Contraseña root MySQL (vacío si no tiene)" "")
DB_NAME=$(read_cfg   "Nombre de la base de datos"  "ecijacomarca")
DB_USER=$(read_cfg   "Usuario MySQL para la API (ENTER = root)"  "root")
DB_PASS=$(read_secret "Contraseña del usuario API (vacío = igual que root)" "$DB_ROOT")
[[ -z "$DB_PASS" ]] && DB_PASS="$DB_ROOT"

# Application
API_PORT=$(read_cfg   "Puerto de la API"            "3000")
MEDIA_PATH=$(read_cfg "Ruta de almacenamiento de medios" "/opt/ecijacomarca/media")

# Accounts
echo ""
echo -e "${GRAY}  Cuentas de usuario:${RESET}"
echo ""
OWNER_USER=$(read_cfg  "Nombre de usuario owner (oculto)" "owner")
OWNER_PASS=$(read_secret "Contraseña owner"               "FeZsS1BkAfuXGaESiSVs3pd0")
ADMIN_USER=$(read_cfg  "Nombre de usuario admin"        "admin")
ADMIN_PASS=$(read_secret "Contraseña admin"              "admin")

# Auto-generated
SECRET_KEY=$(new_secret 64)

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 4 — Write configuration files
# ══════════════════════════════════════════════════════════════════════════════
step "4/7" "Escribiendo archivos de configuración..."

cat > "$ROOT/api/.env" <<EOF
# Auto-generated by setup.sh on $(date '+%Y-%m-%d %H:%M')
DB_HOST=$DB_HOST
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
DB_NAME=$DB_NAME
# Legacy aliases (kept for backward compatibility)
HOST=$DB_HOST
USER=$DB_USER
PASSWORD=$DB_PASS
DATABASE=$DB_NAME

SECRET_KEY=$SECRET_KEY

MEDIA_PATH=$MEDIA_PATH
MAX_FILE_SIZE=53687091200

PORT=$API_PORT
NODE_ENV=production

UPDATE_MANIFEST_URL=
EOF
ok "api/.env creado"

echo '{"version":"2.0.0"}' > "$ROOT/version.json"
ok "version.json → 2.0.0"

# Create directories
mkdir -p "$MEDIA_PATH"
ok "Directorio de medios: $MEDIA_PATH"

mkdir -p "$ROOT/logs" "$ROOT/updates"
ok "Carpetas logs/ y updates/ listas"

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 5 — Install Node dependencies + build frontend
# ══════════════════════════════════════════════════════════════════════════════
step "5/7" "Instalando dependencias..."

# API
info "npm install (API)..."
cd "$ROOT/api" && npm install --prefer-offline &>/dev/null
ok "Dependencias de la API instaladas"

if [[ "$MODE" == "development" ]]; then
    warn "Modo desarrollo: build del frontend omitido."
elif [[ "$SKIP_BUILD" == "false" ]]; then
    # Frontend
    info "npm install (Frontend)..."
    cd "$ROOT/front" && npm install --prefer-offline &>/dev/null

    # Update environment.ts to point to the local API
    ENV_TS="$ROOT/front/src/environments/environment.ts"
    if [[ -f "$ENV_TS" ]]; then
        sed -i "s|API_URL: '[^']*'|API_URL: 'http://localhost:${API_PORT}/api'|g" "$ENV_TS"
        info "environment.ts actualizado -> http://localhost:${API_PORT}/api"
    fi

    info "Compilando Angular (puede tardar 1-2 minutos)..."
    npm run build -- --configuration=production &>/dev/null
    ok "Frontend compilado en front/dist/"
else
    warn "Build del frontend omitido (--skip-build)"
fi

cd "$ROOT"

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 6 — Database setup
# ══════════════════════════════════════════════════════════════════════════════
step "6/7" "Configurando base de datos..."

# Test root connection
if ! mysql_exec "SELECT 1;" root "$DB_ROOT" "$DB_HOST" &>/dev/null; then
    fail "No se pudo conectar a MySQL como root."
    info "Verifica que MySQL esté ejecutándose y que la contraseña sea correcta."
    exit 1
fi
ok "Conexión MySQL con root OK"

# Create database and user
info "Creando base de datos '$DB_NAME'..."
mysql_exec "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" root "$DB_ROOT" "$DB_HOST"

if [[ "$DB_USER" != "root" ]]; then
    info "Creando usuario '$DB_USER'..."
    mysql_exec "CREATE USER IF NOT EXISTS '${DB_USER}'@'${DB_HOST}' IDENTIFIED BY '${DB_PASS}';" root "$DB_ROOT" "$DB_HOST"
    mysql_exec "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'${DB_HOST}'; FLUSH PRIVILEGES;" root "$DB_ROOT" "$DB_HOST"
else
    info "Usando root como usuario de la base de datos (sin crear usuario adicional)."
fi

# Run schema
info "Aplicando esquema..."
mysql_exec_file "$ROOT/db/schema.sql" root "$DB_ROOT" "$DB_HOST" "$DB_NAME"
ok "Esquema aplicado"

# Generate bcrypt hashes and insert users
info "Creando cuentas de usuario..."
HASH_SCRIPT='
const bcrypt = require("bcryptjs");
const COST = 12;
Promise.all([
  bcrypt.hash(process.argv[1], COST),
  bcrypt.hash(process.argv[2], COST)
]).then(([h1, h2]) => console.log(h1 + "\n" + h2));
'
HASHES=$(cd "$ROOT/api" && node -e "$HASH_SCRIPT" "$OWNER_PASS" "$ADMIN_PASS")
OWNER_HASH=$(echo "$HASHES" | sed -n '1p')
ADMIN_HASH=$(echo "$HASHES"  | sed -n '2p')

INSERT_SQL="USE \`${DB_NAME}\`;
INSERT INTO users (id, username, password, role, is_hidden)
  VALUES (1, '${OWNER_USER}', '${OWNER_HASH}', 'owner', 1)
  ON DUPLICATE KEY UPDATE username=VALUES(username), password=VALUES(password), role='owner', is_hidden=1;
INSERT INTO users (id, username, password, role, is_hidden)
  VALUES (2, '${ADMIN_USER}', '${ADMIN_HASH}', 'admin', 0)
  ON DUPLICATE KEY UPDATE username=VALUES(username), password=VALUES(password), role='admin', is_hidden=0;
ALTER TABLE users AUTO_INCREMENT = 3;"

_insert_cnf=""
INSERT_ARGS=(-u root -h "$DB_HOST" --batch --silent)
if [[ -n "$DB_ROOT" ]]; then
    _insert_cnf=$(_mysql_cnf "$DB_ROOT")
    INSERT_ARGS=("--defaults-extra-file=$_insert_cnf" "${INSERT_ARGS[@]}")
fi
echo "$INSERT_SQL" | mysql "${INSERT_ARGS[@]}"
[[ -n "$_insert_cnf" ]] && rm -f "$_insert_cnf"
ok "Usuarios creados: $OWNER_USER (id=1, owner, oculto), $ADMIN_USER (id=2, admin)"

# Insert/update default storage location
ESCAPED_PATH="${MEDIA_PATH//\'/\\\'}"
mysql_exec "USE \`${DB_NAME}\`;
INSERT INTO storage_locations (name, base_path, storage_type, description)
  VALUES ('Subidas locales', '${ESCAPED_PATH}', 'local', 'Directorio de subidas por defecto')
ON DUPLICATE KEY UPDATE base_path='${ESCAPED_PATH}';" root "$DB_ROOT" "$DB_HOST" 2>/dev/null || true

ok "Base de datos lista"

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 7 — Systemd service (Linux) / launchd (macOS)
# ══════════════════════════════════════════════════════════════════════════════
step "7/7" "Configurando servicio de auto-inicio..."

if [[ "$MODE" == "development" ]]; then
    warn "Modo desarrollo: servicio de auto-inicio omitido."
    info "Iniciando API en modo desarrollo..."
    cd "$ROOT/api" && nohup node main.js >> "$ROOT/logs/api.log" 2>&1 &
    ok "API iniciada (PID $!). Logs en logs/api.log"
elif [[ "$SKIP_SERVICE" == "true" ]]; then
    warn "Servicio omitido (--skip-service)"
    info "Iniciando API..."
    cd "$ROOT/api" && nohup node main.js >> "$ROOT/logs/api.log" 2>&1 &
    ok "API iniciada (PID $!)"
elif command -v systemctl &>/dev/null && [[ "$(uname -s)" == "Linux" ]]; then
    # ── systemd ────────────────────────────────────────────────────────────────
    NODE_BIN=$(command -v node)
    SERVICE_FILE="/etc/systemd/system/ecijacomarca.service"
    SERVICE_USER="${SUDO_USER:-$(whoami)}"

    # Ensure the service user exists (if running as root, fall back to root)
    if ! id "$SERVICE_USER" &>/dev/null; then
        SERVICE_USER="root"
    fi

    cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=EcijaComarca Media Manager API
After=network.target mariadb.service mysql.service
Wants=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$ROOT/api
ExecStart=$NODE_BIN $ROOT/api/main.js
Restart=always
RestartSec=5
StartLimitIntervalSec=60
StartLimitBurst=10
StandardOutput=append:$ROOT/logs/api.log
StandardError=append:$ROOT/logs/api.error.log
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable ecijacomarca
    systemctl restart ecijacomarca
    ok "Servicio systemd registrado: ecijacomarca"
    info "Comandos útiles:"
    info "  Estado:  systemctl status ecijacomarca"
    info "  Logs:    journalctl -u ecijacomarca -f"
    info "  Reiniciar: systemctl restart ecijacomarca"

elif [[ "$(uname -s)" == "Darwin" ]]; then
    # ── launchd (macOS) ────────────────────────────────────────────────────────
    NODE_BIN=$(command -v node)
    PLIST_FILE="/Library/LaunchDaemons/com.ecijacomarca.api.plist"
    SERVICE_USER="${SUDO_USER:-root}"

    cat > "$PLIST_FILE" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ecijacomarca.api</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NODE_BIN</string>
        <string>$ROOT/api/main.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$ROOT/api</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>UserName</key>
    <string>$SERVICE_USER</string>
    <key>StandardOutPath</key>
    <string>$ROOT/logs/api.log</string>
    <key>StandardErrorPath</key>
    <string>$ROOT/logs/api.error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
</dict>
</plist>
EOF

    launchctl load -w "$PLIST_FILE" 2>/dev/null || true
    ok "Servicio launchd registrado: com.ecijacomarca.api"
    info "Comandos útiles:"
    info "  Estado:    launchctl list com.ecijacomarca.api"
    info "  Detener:   launchctl stop  com.ecijacomarca.api"
    info "  Iniciar:   launchctl start com.ecijacomarca.api"
else
    warn "Sistema no reconocido para auto-inicio. Inicia la API manualmente:"
    info "  cd api && node main.js"
fi

# ══════════════════════════════════════════════════════════════════════════════
#  SUMMARY
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}  ╔══════════════════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}  ║             ✔  Instalación completada                ║${RESET}"
echo -e "${GREEN}  ╚══════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "${WHITE}  API:           http://localhost:${API_PORT}${RESET}"
echo -e "${WHITE}  Base de datos:  ${DB_NAME}  (@  ${DB_HOST})${RESET}"
echo -e "${WHITE}  Medios:        ${MEDIA_PATH}${RESET}"
echo ""
echo -e "${GRAY}  Credenciales de acceso:${RESET}"
echo -e "${WHITE}    Admin → usuario: ${ADMIN_USER}${RESET}"
echo ""
echo -e "${YELLOW}  Guarda la contraseña del owner en un lugar seguro.${RESET}"
echo -e "${YELLOW}  El archivo api/.env contiene la SECRET_KEY — no lo compartas.${RESET}"
echo ""
if [[ "$SKIP_BUILD" == "false" ]]; then
    echo -e "${GRAY}  Para servir el frontend usa nginx apuntando a front/dist/front/browser/${RESET}"
    echo ""
fi
echo -e "${GRAY}  Para iniciar la API manualmente:${RESET}"
echo -e "${WHITE}    cd api && node main.js${RESET}"
echo ""
