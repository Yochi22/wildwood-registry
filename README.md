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
git clone git@github.com:USUARIO/wildwood-registry.git /opt/wildwood-registry   # USUARIO = cuenta dueña del repositorio
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

**VPS tipo contenedor.** Si `systemd-detect-virt` responde `lxc` u `openvz`, instala también este ajuste antes de iniciar el servicio:

```bash
sudo mkdir -p /etc/systemd/system/wildwood-registry.service.d
sudo cp deploy/lxc.conf /etc/systemd/system/wildwood-registry.service.d/lxc.conf
```

En estos VPS, `ufw` puede fallar. Si falla, omítelo: la app solo escucha en `127.0.0.1` y hacia fuera solo responden SSH (22) y Caddy (80/443).

**Llave de despliegue** (para clonar un repositorio privado). En el VPS, con tu usuario:

```bash
ssh-keygen -t ed25519 -C "vps-deploy" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Pega esa línea en GitHub → repositorio → Settings → Deploy keys → Add deploy key (solo lectura).

En el DNS de wildwood-training.com, crea un registro **A** `registry` que apunte a la IP del VPS. Caddy obtiene el certificado HTTPS automáticamente.

**Si editas el `.env`** (con `nano` o `sed`), vuelve a ajustar sus permisos y reinicia:

```bash
sudo chown $USER:registry .env && chmod 640 .env && sudo systemctl restart wildwood-registry
```

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

### Catálogo de tareas por diagnóstico

Las tareas oficiales están en `shared/task-catalog.json`, agrupadas por diagnóstico (Síncope, Hipoacusia, Ansiedad, Depresión) y traducidas a ES, EN, FR y PT. En el formulario se agregan con un clic por diagnóstico, y el perfil del QR las muestra en el idioma de quien lo consulta. El diagnóstico no se guarda ni se muestra.

Para agregar un diagnóstico o una tarea, edita ese archivo y añade entradas con un `id` nuevo; no cambies los `id` existentes, porque los registros ya guardados los usan. Después, actualiza el servidor como de costumbre.

### Verificación en dos pasos (2FA)

Con `REQUIRE_2FA=true` en `.env`, toda cuenta debe activar una app autenticadora (Google Authenticator, Authy, Microsoft Authenticator) antes de poder usar el panel. Al entrar por primera vez, la persona va directo a «Mi cuenta» para escanear el código QR.

Si alguien pierde el celular:
- Un administrador puede quitarle la 2FA desde «Usuarios».
- Si el afectado es el único administrador, en el VPS:

```bash
cd /opt/wildwood-registry && sudo -u registry node --env-file=.env server/scripts/reset-2fa.js correo@dominio.com
```

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

**Copia fuera del servidor (recomendado).** Un respaldo dentro del mismo VPS no sirve si el VPS se pierde. Con Backblaze B2 (10 GB gratis):

1. En backblaze.com crea un *bucket* **privado** (ej. `wildwood-registry-respaldos`). En su configuración, en *Lifecycle Settings*, elige «Keep only the last version of the file».
2. En *Application Keys*, crea una llave limitada a ese bucket, con permiso de lectura y escritura. Copia el `keyID` y la `applicationKey`, que solo se muestran una vez.
3. En el VPS:

```bash
sudo apt install -y rclone
sudo -u registry rclone config create b2 b2 account TU_KEY_ID key TU_APPLICATION_KEY --config /var/lib/wildwood-registry/rclone.conf
sudo chmod 600 /var/lib/wildwood-registry/rclone.conf
```

4. En `.env`, define `BACKUP_REMOTE=b2:wildwood-registry-respaldos` y `RCLONE_CONFIG=/var/lib/wildwood-registry/rclone.conf`.
5. Prueba: `sudo -u registry node --env-file=.env server/scripts/backup.js` (debe terminar con «subido a b2:…»).

**Recuperar todo en un servidor nuevo** si el VPS se pierde: instala la app como arriba, configura rclone con la misma llave y ejecuta:

```bash
sudo -u registry rclone copy b2:wildwood-registry-respaldos/photos /var/lib/wildwood-registry/backups/photos --config /var/lib/wildwood-registry/rclone.conf
sudo -u registry rclone copy b2:wildwood-registry-respaldos/db /var/lib/wildwood-registry/backups/db --config /var/lib/wildwood-registry/rclone.conf
sudo -u registry node --env-file=.env server/scripts/restore.js NOMBRE_DEL_ULTIMO_ARCHIVO.sqlite.gz
```

**Restaurar:**

```bash
sudo systemctl stop wildwood-registry
sudo -u registry node --env-file=.env server/scripts/restore.js registry-2026-11-26_0317.sqlite.gz
sudo systemctl start wildwood-registry
```

El mismo comando sin nombre de archivo lista los respaldos disponibles. La base anterior se guarda aparte antes de restaurar.
