# Wildwood Service Dog Registry

Registro de perros de servicio y de apoyo emocional de Wildwood Training: panel privado para el equipo y perfil público que se abre al escanear el QR del carnet.

## Funciones

- **Panel privado** con roles: *administrador*, *editor* y *solo lectura*.
- **Registros** en tabla con buscador, filtros (estado, especialidad, país, vencimiento), orden por columna, columnas configurables, paginación, acciones en lote y exportación a CSV/Excel.
- **Ficha del perro** con historial de cambios, QR (PNG/SVG), carnet PDF imprimible (85,6 × 54 mm, frente y reverso) y enlace al perfil.
- **Estado automático** de cada credencial según sus fechas: *inactiva* › *aún no vigente* › *vitalicia* › *vencida* › *vigente*. En el panel se marcan además las que vencen en 30 días.
- **Perfil público** en `/v/<número-de-registro>`: solo los datos de la credencial. Las notas internas nunca se muestran y el documento del guía sale enmascarado.
- **Idiomas:** español, inglés, francés y portugués.
- **Seguridad:**
  - Contraseñas con bcrypt.
  - Sesión en cookie `HttpOnly` + `SameSite=Strict`.
  - Protección CSRF.
  - Verificación en dos pasos (TOTP) opcional por usuario.
  - Bloqueo tras 5 intentos fallidos y límite de peticiones.
  - Cabeceras de seguridad (CSP, HSTS).
  - Las fotos se recodifican y se les quitan los metadatos (GPS).
  - Bitácora de toda acción.

## Stack

- **Frontend:** Vite + React.
- **Backend:** Express 5.
- **Base de datos:** SQLite (better-sqlite3, modo WAL), en un único archivo.
- **Fotos:** en disco, WebP de ~60 KB cada una.

## Desarrollo

```bash
npm install
cp .env.example .env    # en desarrollo basta con dejar NODE_ENV vacío
npm run user:create -- tu@correo.com "Tu Nombre" admin
npm run dev             # API en :3001 y panel en http://localhost:5173
```

Datos de prueba (solo en desarrollo): `node server/scripts/seed-demo.js 60`

Pruebas: `npm test`

## Producción en un VPS (Ubuntu 24.04 / 26.04)

El código pertenece a tu usuario administrador. El servicio corre con el usuario `registry`, que solo puede escribir en `/var/lib/wildwood-registry` (datos), nunca en el código.

```bash
# 1. Sistema y cortafuegos
sudo apt update && sudo apt -y upgrade
sudo apt install -y git curl build-essential caddy unattended-upgrades
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw --force enable
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs

# 2. Usuario del servicio y carpetas
sudo useradd --system --no-create-home --shell /usr/sbin/nologin registry
sudo mkdir -p /opt/wildwood-registry /var/lib/wildwood-registry
sudo chown $USER:$USER /opt/wildwood-registry
sudo chown registry:registry /var/lib/wildwood-registry && sudo chmod 750 /var/lib/wildwood-registry

# 3. Código (repositorio privado: ver «Llave de despliegue» abajo)
git clone git@github.com:Yochi22/wildwood-registry.git /opt/wildwood-registry
cd /opt/wildwood-registry && npm ci && npm run build

# 4. Configuración
cp .env.example .env && nano .env      # JWT_SECRET, PUBLIC_URL, APP_TIMEZONE…
sudo chown $USER:registry .env && chmod 640 .env

# 5. Primer administrador
sudo -u registry node --env-file=.env server/scripts/create-user.js correo@dominio.com "Nombre" admin

# 6. Servicio, HTTPS y respaldos
sudo cp deploy/wildwood-registry.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now wildwood-registry
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy
sudo cp deploy/backup.cron /etc/cron.d/wildwood-registry
```

**Llave de despliegue** (para clonar un repositorio privado). En el VPS, con tu usuario:

```bash
ssh-keygen -t ed25519 -C "vps-deploy" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Pega esa línea en GitHub → repositorio → Settings → Deploy keys → Add deploy key (solo lectura).

En el DNS de wildwood-training.com, crea un registro **A** `registry` que apunte a la IP del VPS. Caddy obtiene el certificado HTTPS automáticamente.

**Actualizar:**

```bash
cd /opt/wildwood-registry && git pull && npm ci && npm run build && sudo systemctl restart wildwood-registry
```

### En un VPS que ya tiene otro proyecto (nginx)

El registro corre aislado: tiene su propio usuario del sistema, su propia carpeta, su propio puerto (3001, solo accesible desde el propio servidor) y su propio subdominio y certificado. Además, el servicio tiene topes de memoria y CPU (`MemoryMax=600M`, `CPUQuota=80%`), así que no puede acaparar el servidor.

Pasos 1 a 5 iguales (sin instalar `caddy` ni tocar el cortafuegos si ya está configurado). En el paso 6, en lugar de Caddy:

```bash
sudo cp deploy/wildwood-registry.service /etc/systemd/system/
sudo systemctl enable --now wildwood-registry
sudo cp deploy/nginx.conf /etc/nginx/sites-available/wildwood-registry
sudo ln -s /etc/nginx/sites-available/wildwood-registry /etc/nginx/sites-enabled/
sudo certbot --nginx -d registry.wildwood-training.com     # obtiene el certificado HTTPS
sudo nginx -t && sudo systemctl reload nginx                # reload no corta el otro sitio
sudo cp deploy/backup.cron /etc/cron.d/wildwood-registry
```

Antes, verifica que el puerto 3001 esté libre (`sudo ss -ltnp | grep 3001`). Si no lo está, cambia `PORT` en `.env` y en `deploy/nginx.conf`.

### Logo

Coloca el logo de Wildwood en PNG con fondo transparente en `DATA_DIR/brand/logo.png`. Se usa en el panel, en el perfil público y en el carnet PDF. Mientras no exista, se muestra un escudo provisional.

### Respaldos

El cron ejecuta `npm run backup` cada noche y respalda en `DATA_DIR/backups/`:

- **Base de datos:** una copia comprimida por día. Se conservan las últimas 14 (`BACKUP_KEEP`).
- **Fotos:** espejo incremental. Solo se agregan las fotos nuevas; nunca se duplican. En el mismo disco no ocupan espacio extra, y una foto borrada por error sigue en el respaldo.

Espacio aproximado de los respaldos:

| Perros | Fotos | Respaldos en el VPS |
|---|---|---|
| 10.000 | ~0,6 GB | ~30 MB (14 copias de la base) |
| 100.000 | ~6 GB | ~300 MB |

**Copia fuera del servidor (recomendado).** Un respaldo dentro del mismo VPS no sirve si el VPS se pierde. Configura `rclone` con Cloudflare R2 o Backblaze B2 (10 GB gratis en ambos) y define `BACKUP_REMOTE` en `.env`, por ejemplo `BACKUP_REMOTE=r2:wildwood-respaldos`. Desde entonces cada respaldo se sube solo.

**Restaurar:**

```bash
sudo systemctl stop wildwood-registry
sudo -u registry npm run restore -- registry-2026-11-26_0317.sqlite.gz
sudo systemctl start wildwood-registry
```

`npm run restore` sin argumentos lista los respaldos disponibles. La base anterior se guarda aparte antes de restaurar.
