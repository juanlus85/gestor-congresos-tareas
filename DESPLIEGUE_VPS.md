# Despliegue en VPS del Gestor de congresos

**Versión de despliegue:** 1.6.  
**Autor:** Manus AI.

Esta guía instala la aplicación en un servidor Ubuntu 24.04 con MySQL compatible mediante MariaDB, Node.js 22, Nginx y HTTPS. La aplicación no funciona como una página estática en `httpdocs`: necesita un proceso Node.js persistente, una base de datos y almacenamiento local protegido para los documentos.

| Requisito | Valor esperado |
|---|---|
| Sistema operativo | Ubuntu Server 24.04 LTS o equivalente compatible con `apt` |
| Dominio | Subdominio propio, por ejemplo `congresos.su-dominio.es`, apuntando a la IP del VPS |
| Red | Puertos TCP 80 y 443 disponibles desde Internet |
| Repositorio | `https://github.com/juanlus85/gestor-congresos-tareas` (privado) |
| Datos | MySQL/MariaDB local y documentos en `/var/lib/gestor-congresos/documents` |

## 1. Obtener el código desde GitHub

Inicie sesión por SSH en el VPS con un usuario que tenga `sudo`. Como el repositorio es privado, configure una clave de despliegue de **sólo lectura** en GitHub antes de clonarlo. Esta clave permite que el VPS descargue actualizaciones sin almacenar una contraseña personal.

```bash
sudo apt-get update
sudo apt-get install -y git openssh-client
sudo useradd --system --create-home --shell /bin/bash omc7wp 2>/dev/null || true
sudo -u omc7wp mkdir -p /home/omc7wp/.ssh
sudo -u omc7wp ssh-keygen -t ed25519 -N '' -f /home/omc7wp/.ssh/id_ed25519_github -C 'gestor-congresos-vps'
sudo cat /home/omc7wp/.ssh/id_ed25519_github.pub
```

Copie la clave pública mostrada. En el repositorio de GitHub, abra **Settings → Deploy keys → Add deploy key**, asigne el nombre `VPS gestor-congresos`, pegue la clave y deje desmarcado el permiso de escritura. Después ejecute:

```bash
sudo -u omc7wp ssh-keyscan github.com >> /home/omc7wp/.ssh/known_hosts
sudo install -d -o omc7wp -g omc7wp /opt/gestor-congresos
sudo -u omc7wp env GIT_SSH_COMMAND='ssh -i /home/omc7wp/.ssh/id_ed25519_github -o IdentitiesOnly=yes' \
  git clone git@github.com:juanlus85/gestor-congresos-tareas.git /opt/gestor-congresos
sudo -u omc7wp git -C /opt/gestor-congresos config core.sshCommand 'ssh -i /home/omc7wp/.ssh/id_ed25519_github -o IdentitiesOnly=yes'
```

> Si el código ya está en `/opt/gestor-congresos`, no lo clone de nuevo. Ejecute las instrucciones de actualización de la sección 5.

## 2. Definir las variables privadas del sistema

La aplicación **no usa un archivo `.env` dentro del proyecto**. Las variables se almacenan en el archivo privado de `systemd` `/etc/gestor-congresos/gestor-congresos.env`, accesible sólo por `root` y el proceso de la aplicación.

Cree secretos en el propio VPS. La contraseña de MySQL debe tener sólo letras y números para que el instalador pueda crear el usuario de base de datos con seguridad.

```bash
openssl rand -hex 32   # Copie este valor como JWT_SECRET
openssl rand -hex 24   # Copie este valor como MYSQL_APP_PASSWORD
```

A continuación, cree la configuración y sustituya todos los valores `REEMPLACE_...`:

```bash
sudo install -d -o root -g omc7wp -m 0750 /etc/gestor-congresos
sudo cp /opt/gestor-congresos/deployment/gestor-congresos.env.example /etc/gestor-congresos/gestor-congresos.env
sudo nano /etc/gestor-congresos/gestor-congresos.env
sudo chown root:omc7wp /etc/gestor-congresos/gestor-congresos.env
sudo chmod 0640 /etc/gestor-congresos/gestor-congresos.env
```

El valor de `DATABASE_URL` debe contener exactamente la misma contraseña que `MYSQL_APP_PASSWORD`. Defina una cuenta administradora inicial con un correo real y una contraseña de al menos diez caracteres que combine letras y números. Si cambia posteriormente `JWT_SECRET`, las sesiones abiertas se invalidarán y habrá que volver a guardar la contraseña SMTP.

## 3. Instalar la aplicación y obtener HTTPS

Antes de continuar, confirme que el DNS del dominio ya resuelve a la IP del VPS. Sustituya el dominio y el correo en el comando. El instalador prepara Node.js 22, pnpm, MariaDB, Nginx, la base MySQL, las migraciones, el servicio `systemd`, el proxy y el certificado TLS de Let's Encrypt.

```bash
cd /opt/gestor-congresos
sudo bash deployment/install-vps.sh \
  --domain congresos.su-dominio.es \
  --email administrador@su-dominio.es
```

El instalador comprueba al terminar que `https://congresos.su-dominio.es/` responde. Si el certificado no puede emitirse, revise primero el DNS y que los puertos 80 y 443 no estén bloqueados por el proveedor del VPS o por un cortafuegos externo.

## 4. Comprobación operativa

Utilice estos comandos para comprobar la aplicación y diagnosticar un posible problema. El servicio debe aparecer como `active (running)` y el proxy Nginx debe validar su configuración.

```bash
sudo systemctl status gestor-congresos --no-pager
sudo journalctl -u gestor-congresos -n 100 --no-pager
sudo nginx -t
curl -I https://congresos.su-dominio.es/
```

Abra la dirección HTTPS y acceda con el correo y la clave iniciales. Cree las demás cuentas desde **Personas**. Los organizadores administradores ven todas las tareas, grupos y documentos. Los colaboradores ven sólo las tareas asignadas directamente o mediante un grupo.

## 5. Actualizar desde GitHub

El siguiente procedimiento conserva la base de datos y los documentos. Realice primero una copia de seguridad; después descargue el código, aplique migraciones y reinicie el servicio.

```bash
sudo mysqldump gestor_congresos > /var/backups/gestor_congresos_$(date +%F).sql
sudo tar -C /var/lib/gestor-congresos -czf /var/backups/gestor_documentos_$(date +%F).tgz documents

sudo -u omc7wp git -C /opt/gestor-congresos pull --ff-only origin main
sudo -u omc7wp -H bash -lc 'cd /opt/gestor-congresos && corepack pnpm install --frozen-lockfile'
sudo -u omc7wp -H bash -lc 'set -a; source /etc/gestor-congresos/gestor-congresos.env; set +a; cd /opt/gestor-congresos && corepack pnpm drizzle-kit migrate && corepack pnpm build'
sudo systemctl restart gestor-congresos
sudo systemctl status gestor-congresos --no-pager
```

## 6. Copias de seguridad

La copia válida incluye dos elementos: la base `gestor_congresos` y los archivos de `/var/lib/gestor-congresos/documents`. La base contiene usuarios, tareas, grupos, permisos, verificaciones, metadatos documentales y ajustes SMTP cifrados. Los archivos contienen los documentos reales. Programe ambos respaldos en el sistema de copias de seguridad que ya utilice el VPS.

## Referencias

[1]: https://nodejs.org/en/download/package-manager "Node.js package manager installation instructions"
[2]: https://certbot.eff.org/instructions?ws=nginx&os=ubuntufocal "Certbot instructions for Nginx and Ubuntu"
[3]: https://docs.github.com/authentication/connecting-to-github-with-ssh/managing-deploy-keys "GitHub deploy keys"
[4]: https://mariadb.com/kb/en/mariadb-installation-version-1011/ "MariaDB installation documentation"
