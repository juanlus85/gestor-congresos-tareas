# Gestor de congresos y tareas compartidas

**Versión v1.4 · 08/09/2026 16:58**

## Resumen operativo

La aplicación se instala de forma autónoma en un VPS con Node.js y MySQL o MariaDB. La base de datos contiene cuentas, tareas, grupos, verificaciones, catálogos, configuración SMTP y metadatos de documentos. Los archivos documentales no se guardan como datos binarios en MySQL: se guardan en una carpeta protegida del VPS y MySQL conserva únicamente su referencia y sus metadatos.

| Área | Capacidades incluidas |
|---|---|
| Cuentas locales | Inicio de sesión por correo y clave, con perfiles de organizador administrador y colaborador. |
| Tareas | Asignación múltiple a personas o grupos, avance, solicitud de verificación y confirmación de cierre. |
| Catálogos | Estados, prioridades, comités, módulos, fases, cargos, posiciones y publicaciones editables. |
| Documentos | Biblioteca por congreso, subida de archivos, categorías, visibilidad y descarga protegida. |
| Correo | Selección de personas o grupos, SMTP cifrado y trazabilidad de envíos. |

## Inicio de sesión local

Cada persona debe disponer de un correo, una clave y el estado **Activo**. La clave debe tener por lo menos diez caracteres e incluir letras y números. Desde la versión 1.4, el acceso normaliza el correo y vuelve a cargar el espacio después de crear la cookie de sesión. Esto evita que el navegador conserve un estado de sesión anterior.

Cuando la persona ya existe por importación con el mismo correo pero sin clave, el administrador puede crear la cuenta desde **Personas y cuentas**. El sistema completa ese perfil existente con la nueva clave en lugar de crear una duplicidad. Si existe más de un perfil heredado con el mismo correo, el inicio de sesión elige el perfil activo que tenga una clave local válida.

| Comprobación si no inicia sesión | Acción administrativa |
|---|---|
| Correo | Revisar que coincide exactamente con el correo de **Personas y cuentas**. Los espacios y las mayúsculas no afectan al acceso. |
| Clave | Restablecerla desde **Editar persona** si existe cualquier duda. |
| Perfil | Confirmar que aparece como **Activo**. Un perfil suspendido no puede entrar. |
| Cuenta heredada | Crear o actualizar la persona usando el mismo correo para añadir una clave local. |
| Navegador | Cerrar sesión, recargar la página y volver a introducir el correo y la clave. |

> En un VPS, el sitio debe estar detrás de HTTPS. La cookie local se emite con `Secure` y `SameSite=None`, por lo que el navegador sólo la aceptará desde una dirección HTTPS válida.

## Catálogos reutilizables

El menú **Configuración** incorpora los valores heredados y permite crear, editar y reutilizar los siguientes catálogos en congresos posteriores. Las categorías de tareas permanecen específicas de cada congreso y se administran desde el menú **Categorías**.

| Catálogo | Valores iniciales incluidos |
|---|---|
| Estados | Pendiente, En curso, Resuelta, Adjudicada a otro comité, Bloqueada, No aplica y Revisar. |
| Prioridades | Alta, Media y Baja. |
| Comités | Local Organizing Committee, Comité Científico / ACEDEDOT, Comité Ejecutivo ACEDEDOT, Comunicación, Steering Committee, Secretaría Técnica, Finanzas y grupos combinados. |
| Módulos | Dashboard, Notifications, Calendar, Messages, Announcements, Meetings, Conferences, Paper Proposals, Events, Documents, Links, Tasks, Users y Settings. |
| Fases | Arranque, planificación general, programa científico, plataforma y comunicación, participantes, logística, protocolo, ejecución, cierre y transversal. |
| Cargos | Pendiente de asignar, Chair, Co-Chair y Co-Chair de sesiones invitadas y ponencias principales. |
| Publicaciones | Papers, Abstracts, Extended Abstracts y Posters. |

## Biblioteca de documentos

La sección **Documentos** permite a los organizadores subir materiales comunes para cada congreso. Se aceptan PDF, Word, Excel, PowerPoint, CSV, texto e imágenes de hasta 10 MB. Cada documento tiene título, categoría documental y visibilidad. Los documentos marcados **Todos** o **Comités** están disponibles para los usuarios conectados; los marcados **Organizadores** se restringen al perfil administrador.

La descarga se realiza desde una ruta protegida que verifica la sesión y la visibilidad antes de entregar el archivo. Retirar un documento elimina su ficha de la aplicación y corta el acceso, sin ejecutar un borrado irreversible del archivo de respaldo en disco.

## Configuración SMTP y mensajería

En el menú **Mensajes**, un organizador puede configurar servidor, puerto, usuario, contraseña, remitente y tipo de conexión. La contraseña se cifra antes de almacenarse y no se muestra después. El envío a personas o grupos se realiza sólo cuando el organizador pulsa **Enviar correo**; cada resultado queda registrado en el historial.

## Crear la base de datos MySQL

Instale MySQL 8 o MariaDB 10.6 o superior en el VPS. Adapte la clave de `deployment/mysql-bootstrap.sql` y ejecútelo como administrador de MySQL. El fichero crea la base `gestor_congresos` y el usuario de aplicación con permisos limitados a esa base.

```bash
sudo mysql < /opt/gestor-congresos/deployment/mysql-bootstrap.sql
```

Aplique las migraciones de la aplicación una vez que `DATABASE_URL` esté definido en el servicio de sistema.

```bash
cd /opt/gestor-congresos
sudo -u omc7wp pnpm drizzle-kit migrate
```

## Instalación en VPS

El servidor requiere Ubuntu 24.04 o equivalente, Node.js 22, `pnpm`, MySQL/MariaDB, Nginx y TLS. No utilice archivos `.env` para las credenciales productivas. Defina `DATABASE_URL`, `JWT_SECRET` y los valores de administrador inicial en `deployment/omc7wp.service` antes de instalarlo.

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin omc7wp
sudo mkdir -p /opt/gestor-congresos/storage/documents
sudo chown -R omc7wp:omc7wp /opt/gestor-congresos

cd /opt/gestor-congresos
sudo -u omc7wp corepack enable
sudo -u omc7wp pnpm install --frozen-lockfile
sudo -u omc7wp pnpm drizzle-kit migrate
sudo -u omc7wp pnpm build

sudo cp deployment/omc7wp.service /etc/systemd/system/gestor-congresos.service
sudo systemctl daemon-reload
sudo systemctl enable --now gestor-congresos
```

El servicio usa `/opt/gestor-congresos/storage/documents` para los ficheros subidos. Para ubicar los archivos en otra partición, cree una carpeta propiedad de `omc7wp`, añada `Environment=DOCUMENTS_DIRECTORY=/ruta/segura/documentos` y actualice `ReadWritePaths` en el servicio.

## Nginx, HTTPS y copias de seguridad

Aplique la plantilla `deployment/nginx-omc7wp.conf` después de sustituir el dominio y las rutas del certificado. Nginx debe transmitir los encabezados `Host` y `X-Forwarded-Proto`. No instale la aplicación como archivos estáticos en `httpdocs`: necesita el proceso Node.js, MySQL, Nginx y el servicio `systemd` activos.

Las copias de seguridad deben incluir tanto MySQL como la carpeta de documentos.

```bash
mysqldump -u gestor_app -p gestor_congresos > /var/backups/gestor_congresos_$(date +%F).sql
sudo tar -C /opt/gestor-congresos/storage -czf /var/backups/gestor_documentos_$(date +%F).tgz documents
```

Para actualizar la aplicación, haga primero estas dos copias, despliegue el código, ejecute las migraciones, compile y reinicie el servicio.

```bash
cd /opt/gestor-congresos
sudo -u omc7wp pnpm drizzle-kit migrate
sudo -u omc7wp pnpm build
sudo systemctl restart gestor-congresos
```

## Validación incluida

La versión incorpora pruebas de claves locales, cookies de sesión, cifrado SMTP y validación de formatos documentales. Antes de liberar una actualización se deben ejecutar las pruebas automatizadas, la comprobación de TypeScript y la compilación de producción.

## Referencias

[1]: https://nodejs.org/api/environment_variables.html "Node.js environment variables"
[2]: https://expressjs.com/en/advanced/best-practice-security.html "Express production security best practices"
