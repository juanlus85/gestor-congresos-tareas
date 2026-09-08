#!/usr/bin/env bash
# Instalador del Gestor de congresos para Ubuntu 24.04.
# Ejecútese como root después de clonar el repositorio en /opt/gestor-congresos.
set -Eeuo pipefail

APP_DIR="/opt/gestor-congresos"
APP_USER="omc7wp"
CONFIG_DIR="/etc/gestor-congresos"
ENV_FILE="$CONFIG_DIR/gestor-congresos.env"
SERVICE_NAME="gestor-congresos"
DOMAIN=""
EMAIL=""

usage() {
  cat <<'EOF'
Uso: sudo bash deployment/install-vps.sh --domain congresos.ejemplo.es --email admin@ejemplo.es

La configuración privada debe existir previamente en:
  /etc/gestor-congresos/gestor-congresos.env

No añada ese archivo al repositorio. Use deployment/gestor-congresos.env.example como plantilla.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --email) EMAIL="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Opción no reconocida: $1" >&2; usage; exit 1 ;;
  esac
done

[[ ${EUID} -eq 0 ]] || { echo "Ejecute este instalador con sudo." >&2; exit 1; }
[[ -n "$DOMAIN" && -n "$EMAIL" ]] || { echo "Indique --domain y --email." >&2; usage; exit 1; }
[[ -d "$APP_DIR/.git" ]] || { echo "No se encuentra el repositorio en $APP_DIR. Clónelo antes de continuar." >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "Falta $ENV_FILE. Copie y complete la plantilla antes de continuar." >&2; exit 1; }

# El archivo es administrado por el sistema y contiene únicamente claves simples.
set -a
source "$ENV_FILE"
set +a
: "${DATABASE_URL:?DATABASE_URL no está definido en $ENV_FILE}"
: "${MYSQL_APP_PASSWORD:?MYSQL_APP_PASSWORD no está definido en $ENV_FILE}"
: "${JWT_SECRET:?JWT_SECRET no está definido en $ENV_FILE}"
: "${INITIAL_ADMIN_EMAIL:?INITIAL_ADMIN_EMAIL no está definido en $ENV_FILE}"
: "${INITIAL_ADMIN_PASSWORD:?INITIAL_ADMIN_PASSWORD no está definido en $ENV_FILE}"

if [[ ${#JWT_SECRET} -lt 32 ]]; then
  echo "JWT_SECRET debe contener al menos 32 caracteres." >&2
  exit 1
fi
if [[ ! "$MYSQL_APP_PASSWORD" =~ ^[A-Za-z0-9]+$ ]]; then
  echo "MYSQL_APP_PASSWORD debe contener sólo letras y números para el instalador." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg git nginx mariadb-server certbot python3-certbot-nginx
if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(`.`)[0]')" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
corepack enable
corepack prepare pnpm@10.15.1 --activate

id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
install -d -o "$APP_USER" -g "$APP_USER" -m 0750 /var/lib/gestor-congresos/documents
install -d -o root -g "$APP_USER" -m 0750 "$CONFIG_DIR"
chmod 0640 "$ENV_FILE"
chown root:"$APP_USER" "$ENV_FILE"

# La contraseña se usa sólo en local. El usuario de MySQL no tiene permisos fuera de la base de la aplicación.
mysql --protocol=socket -uroot <<SQL
CREATE DATABASE IF NOT EXISTS gestor_congresos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'gestor_app'@'127.0.0.1' IDENTIFIED BY '${MYSQL_APP_PASSWORD}';
ALTER USER 'gestor_app'@'127.0.0.1' IDENTIFIED BY '${MYSQL_APP_PASSWORD}';
GRANT ALL PRIVILEGES ON gestor_congresos.* TO 'gestor_app'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

chown -R "$APP_USER:$APP_USER" "$APP_DIR"
sudo -u "$APP_USER" -H bash -lc "cd '$APP_DIR' && corepack pnpm install --frozen-lockfile"
sudo -u "$APP_USER" -H env DATABASE_URL="$DATABASE_URL" bash -lc "cd '$APP_DIR' && corepack pnpm drizzle-kit migrate"
sudo -u "$APP_USER" -H bash -lc "cd '$APP_DIR' && corepack pnpm build"

install -m 0644 "$APP_DIR/deployment/omc7wp.service" "/etc/systemd/system/$SERVICE_NAME.service"
sed "s/__DOMAIN__/$DOMAIN/g" "$APP_DIR/deployment/nginx-omc7wp.conf" > "/etc/nginx/sites-available/$SERVICE_NAME"
ln -sfn "/etc/nginx/sites-available/$SERVICE_NAME" "/etc/nginx/sites-enabled/$SERVICE_NAME"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"
systemctl reload nginx

if systemctl is-active --quiet ufw; then
  ufw allow 'Nginx Full'
fi

certbot --nginx --non-interactive --agree-tos --redirect --email "$EMAIL" -d "$DOMAIN"
systemctl is-active --quiet "$SERVICE_NAME"
curl --fail --silent --show-error --max-time 15 "https://$DOMAIN/" >/dev/null

echo "Instalación completada: https://$DOMAIN"
echo "Compruebe el servicio con: sudo systemctl status $SERVICE_NAME"
