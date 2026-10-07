#!/usr/bin/env bash
# ============================================================
# Prepara una instancia Lightsail nueva (Ubuntu 22.04 / 24.04):
#   - Docker + Docker Compose
#   - 2 GB de swap (Chromium necesita margen al generar PDFs)
#   - Firewall (solo SSH, HTTP y HTTPS)
#   - Actualizaciones de seguridad automáticas
#
# Uso:  sudo bash scripts/setup-server.sh
# ============================================================
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecutar con sudo"; exit 1
fi

echo "==> Actualizando paquetes"
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

echo "==> Instalando Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
TARGET_USER="${SUDO_USER:-ubuntu}"
usermod -aG docker "$TARGET_USER"
systemctl enable --now docker

# Rotación de logs de contenedores para que no llenen el disco
cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
systemctl restart docker

echo "==> Configurando swap de 2 GB"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10
  echo 'vm.swappiness=10' > /etc/sysctl.d/99-swappiness.conf
fi

echo "==> Firewall (además del firewall de Lightsail)"
apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

echo "==> Actualizaciones de seguridad automáticas"
DEBIAN_FRONTEND=noninteractive apt-get install -y unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

echo
echo "✅ Servidor listo. Cerrar sesión SSH y volver a entrar para usar docker sin sudo."
