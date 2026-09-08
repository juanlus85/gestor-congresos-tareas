# Gestor de congresos y tareas compartidas

**Versión v1.3 · 08/09/2026 16:47**

## Alcance funcional

La aplicación es autónoma y está preparada para instalarse en un VPS externo. Todos los congresos, personas usuarias, perfiles, grupos, tareas, verificaciones e historial de correos se almacenan en una base de datos **MySQL** propia, accesible para exportación o migración mediante herramientas habituales de MySQL, CSV o Excel.

| Función | Comportamiento |
|---|---|
| Categorías | Se pueden crear, editar y eliminar. Al eliminar una categoría, las tareas se conservan y quedan sin categoría. |
| Tareas resueltas | No se muestran por defecto en los listados. El botón **Ver tareas resueltas** las muestra o las vuelve a ocultar. |
| Finalización | La persona asignada envía la tarea para verificación. Un organizador administrador la confirma como resuelta o la devuelve con un comentario. |
| Notificación de revisión | Si SMTP está configurado, el sistema avisa a los organizadores al recibir una solicitud y a la persona cuando se revisa. |
| Mensajería | Los organizadores pueden enviar correos a una o varias personas y grupos. Los destinatarios se resuelven por personas activas con correo. |
| Trazabilidad | Se registra el historial de correos enviados, solicitudes de verificación, persona solicitante, revisor y comentarios. |

## Flujo de verificación de tareas

Las personas colaboradoras pueden avanzar una tarea y guardar su estado habitual. Cuando terminan, seleccionan **Enviar para verificación** e incluyen una nota o enlace de entrega si es necesario. La tarea pasa al estado **Pendiente de verificación** y deja de poder marcarse como resuelta directamente.

Los organizadores administradores consultan el menú **Verificaciones**. Desde allí pueden confirmar la tarea como resuelta o devolverla a la persona con instrucciones. Sólo tras esa confirmación, la tarea recibe el estado **Resuelta** y queda oculta por defecto en los listados.

## Configuración SMTP y mensajería

En el menú **Mensajes**, un organizador debe abrir **Configurar SMTP** e introducir el servidor, puerto, usuario, contraseña, remitente y tipo de conexión. La contraseña se cifra antes de guardarse en MySQL y no vuelve a mostrarse en la interfaz. El botón **Enviar correo** realiza un envío real al proveedor SMTP configurado y deja una entrada de trazabilidad, incluyendo los errores de entrega comunicados por el servidor SMTP.

> Configure SMTP en el VPS antes del primer envío. Para Microsoft 365, Google Workspace u otro proveedor, use una cuenta de servicio, una contraseña de aplicación o el mecanismo SMTP autenticado que determine el administrador de correo.

## Crear la base de datos MySQL

En el VPS, instale MySQL 8 o MariaDB 10.6 o superior. Ejecute el archivo `deployment/mysql-bootstrap.sql` como administrador de MySQL después de sustituir la clave de ejemplo. Crea la base `gestor_congresos`, el usuario limitado `gestor_app` y los permisos necesarios exclusivamente para esa base.

```bash
sudo mysql < /opt/gestor-congresos/deployment/mysql-bootstrap.sql
```

Los datos quedan en MySQL y pueden exportarse sin depender de la aplicación:

```bash
mysqldump -u gestor_app -p gestor_congresos > gestor_congresos_$(date +%F).sql
mysql -u gestor_app -p --batch --skip-column-names \
  -e "SELECT id, name, email, role, jobTitle, position FROM gestor_congresos.members" \
  > usuarios.tsv
```

## Instalación en VPS

El VPS necesita Ubuntu 24.04 o equivalente, Node.js 22, `pnpm`, MySQL/MariaDB, Nginx y un certificado HTTPS. No use un archivo `.env`: las credenciales se definen como variables de entorno del sistema en el servicio `systemd`.

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin omc7wp
sudo mkdir -p /opt/gestor-congresos
sudo chown -R omc7wp:omc7wp /opt/gestor-congresos

cd /opt/gestor-congresos
sudo -u omc7wp corepack enable
sudo -u omc7wp pnpm install --frozen-lockfile
sudo -u omc7wp pnpm drizzle-kit migrate
sudo -u omc7wp pnpm build
```

Copie y adapte `deployment/omc7wp.service` en `/etc/systemd/system/gestor-congresos.service`. Debe sustituir `DATABASE_URL`, `JWT_SECRET`, `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD` por valores seguros del entorno de producción. Después active el servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now gestor-congresos
sudo systemctl status gestor-congresos
```

En el primer inicio, la aplicación crea la cuenta definida por `INITIAL_ADMIN_EMAIL` si no existe. El administrador debe iniciar sesión con ese correo y clave, crear las cuentas reales y, después, retirar `INITIAL_ADMIN_PASSWORD` de la definición del servicio para evitar conservar una clave inicial.

## Nginx y HTTPS

Copie `deployment/nginx-omc7wp.conf` a Nginx, cambie el nombre del dominio y configure un certificado TLS válido. Nginx debe reenviar los encabezados `Host` y `X-Forwarded-Proto` para que la cookie de sesión se marque como segura. La aplicación no está diseñada para instalarse como archivos estáticos mediante FTP en `httpdocs`: requiere un proceso Node.js persistente, MySQL y un proxy HTTPS en el VPS.

## Copias de seguridad y actualización

Programe una copia diaria de MySQL en el VPS y conserve varias versiones fuera del servidor. Para actualizar la aplicación, copie previamente la base, despliegue el código, ejecute las migraciones de Drizzle, compile y reinicie el servicio.

```bash
cd /opt/gestor-congresos
sudo -u omc7wp pnpm drizzle-kit migrate
sudo -u omc7wp pnpm build
sudo systemctl restart gestor-congresos
```

## Validación incluida

La versión incluye pruebas de seguridad de claves locales, cifrado de credenciales SMTP, cierre de sesión, permisos e integridad de la matriz importada. Antes de liberar la versión se ejecutan las pruebas automatizadas, la comprobación de TypeScript y la compilación de producción.
