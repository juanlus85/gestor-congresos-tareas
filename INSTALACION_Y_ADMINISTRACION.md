# 7WP&OMC · Centro de coordinación

**Versión v1.0 · 08/09/2026 15:47**

## Propósito y alcance

Esta aplicación sustituye el uso de la matriz compartida como instrumento principal de coordinación. Conserva las **152 tareas** del archivo `Matriz_organizacion_congresoJLUISYGRX.xlsx`, sus 27 campos operativos y los ocho miembros organizadores iniciales. La aplicación permite consultar, filtrar, actualizar y exportar las tareas visibles para cada perfil. También añade trazabilidad de actualizaciones, reuniones, decisiones y documentos enlazados.

La primera carga identifica **64 tareas** en las que interviene el Local Organizing Committee. Estas tareas se presentan además en una vista independiente, agrupada para la asignación de trabajo de la próxima reunión.

| Área | Funcionalidad disponible |
|---|---|
| Plan maestro | Matriz filtrable por fase y estado, buscador, ficha completa, responsable, prioridad, porcentaje de avance y exportación a CSV. |
| Comité local | Copia operativa de las tareas locales, agrupada por bloques de carga y contenido. |
| Seguimiento | Registro de avances, acuerdos e incidencias directamente en cada tarea. |
| Gobierno | Agenda y registro de reuniones con comité, fecha, estado y notas. |
| Documentos | Registro de enlaces a actas, evidencias, contratos, versiones en inglés y repositorios institucionales. |
| Administración | Alta de personas, vinculación por correo y asignación de permisos. |
| Finanzas | Vista restringida de presupuesto, patrocinios, ayudas y proveedores. |

## Propuesta de trabajo para el Comité local

La aplicación no elimina información de la matriz original. La vista **Comité local** selecciona las tareas donde aparece el Local Organizing Committee, el Comité de Comunicación Local o Tesorería / Finanzas Local como comité, responsable o apoyo. Las tareas se agrupan para facilitar una distribución inicial entre miembros.

| Bloque propuesto | Contenido predominante | Tareas importadas |
|---|---|---:|
| Sede y operaciones | Espacios, señalización, catering, materiales, audiovisuales y operación en sede. | 38 |
| Coordinación local | Coordinación, participantes y tareas transversales de apoyo local. | 9 |
| Experiencia y hospitalidad | Actos sociales, protocolo, viajes, alojamiento, inscripción y atención. | 7 |
| Coordinación y gobierno | Gobierno, constitución y funcionamiento inicial del comité. | 4 |
| Patrocinio y recursos | Ayudas, patrocinios y recursos económicos que requieren apoyo local. | 3 |
| Comunicación y visibilidad | Comunicación local, web y relaciones institucionales. | 2 |
| Calidad, cierre y evidencias | Evaluación, archivo, certificados y evidencias de cierre. | 1 |

La propuesta es una primera partición operativa. Desde cada ficha se puede reasignar la persona responsable y anotar el acuerdo que motivó la adjudicación.

## Modelo de usuarios y permisos

La autenticación protege todas las vistas de trabajo. Administración crea el perfil de una persona con su nombre, correo, comité y nivel de acceso. Cuando esa persona inicia sesión con el mismo correo, la plataforma aplica el perfil configurado.

| Perfil | Puede ver | Puede modificar |
|---|---|---|
| **Administración** | Todo el plan, finanzas, personas y permisos. | Todo, incluido crear usuarios y cambiar permisos. |
| **Dirección** | Todo el plan y finanzas. | Tareas, reuniones, documentos y estructura operativa. |
| **Comité local** | Sólo tareas con participación local y su agrupación específica. | Las tareas locales, sus avances, reuniones y documentos. |
| **Comité científico** | Programa científico, revisión y publicaciones. | Las tareas de su ámbito y documentos asociados. |
| **Secretaría técnica** | Tareas de secretaría y módulos operativos asociados. | Las tareas de su ámbito, reuniones y documentos. |
| **Colaborador/a** | Las tareas donde aparece como responsable o apoyo. | Sus tareas y actualizaciones. |
| **Consulta** | Sólo las vistas que el perfil tenga autorizadas. | No puede modificar información. |

> **Criterio de seguridad:** el filtrado de permisos se aplica en la API del servidor, no sólo en el menú de la interfaz. Ocultar una opción visual no concede acceso a su contenido.

## Requisitos de instalación

La aplicación es un proyecto Node.js con React, Express, tRPC, Drizzle ORM y MySQL/TiDB. Para instalarla en un servidor propio se requiere Node.js 22 o superior, `pnpm`, una base de datos MySQL 8 o compatible, un proxy inverso HTTPS y un proveedor de identidad OAuth 2.0 compatible. Node.js expone las variables de configuración del proceso mediante `process.env`, por lo que esta instalación utiliza variables de entorno del sistema y no depende de archivos `.env`. [1]

| Requisito | Recomendación |
|---|---|
| Sistema operativo | Ubuntu Server 24.04 LTS o equivalente. |
| Runtime | Node.js 22 LTS y Corepack habilitado. |
| Base de datos | MySQL 8.0 o TiDB, con una base y un usuario exclusivos. |
| Servicio web | Nginx con certificado TLS. |
| Identidad | OAuth 2.0 u OpenID Connect, con retorno autorizado en `/api/oauth/callback`. |

## Procedimiento de despliegue

### 1. Copiar el proyecto y preparar dependencias

Copie el contenido completo de la carpeta del proyecto al servidor, por ejemplo a `/opt/7wp-omc-control`. Después, ejecute el siguiente procedimiento con el usuario de servicio que vaya a operar la aplicación.

```bash
cd /opt/7wp-omc-control
corepack enable
pnpm install --frozen-lockfile
```

### 2. Crear la base de datos

Cree la base de datos y un usuario de aplicación con una contraseña robusta. Sustituya los valores de ejemplo antes de ejecutar el comando.

```sql
CREATE DATABASE omc7wp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'omc7wp_app'@'localhost' IDENTIFIED BY 'CAMBIAR_POR_CLAVE_ROBUSTA';
GRANT ALL PRIVILEGES ON omc7wp.* TO 'omc7wp_app'@'localhost';
FLUSH PRIVILEGES;
```

### 3. Definir variables de entorno del servicio

Defina las variables en el gestor de servicios del sistema. No incluya secretos en el repositorio ni en archivos `.env`. El ejemplo siguiente muestra las variables mínimas que deben existir en una unidad `systemd`.

```ini
[Service]
WorkingDirectory=/opt/7wp-omc-control
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DATABASE_URL=mysql://omc7wp_app:CAMBIAR_POR_CLAVE_ROBUSTA@127.0.0.1:3306/omc7wp
Environment=JWT_SECRET=CAMBIAR_POR_SECRETO_ALEATORIO_DE_64_CARACTERES
Environment=VITE_APP_ID=IDENTIFICADOR_DE_LA_APLICACION_OAUTH
Environment=OAUTH_SERVER_URL=https://su-proveedor-de-identidad.example
Environment=VITE_OAUTH_PORTAL_URL=https://su-proveedor-de-identidad.example
ExecStart=/usr/bin/pnpm start
Restart=always
RestartSec=5
```

El proveedor de identidad debe admitir como URL de retorno `https://congreso.su-dominio.es/api/oauth/callback`. La plantilla actual utiliza autenticación OAuth de Manus durante la vista previa. Para un servidor propio se debe registrar esta URL de retorno en el proveedor de identidad corporativo elegido y reemplazar sus valores de configuración por los de dicho proveedor.

### 4. Aplicar la estructura y construir la aplicación

En una instalación nueva, ejecute la migración y la compilación antes de arrancar el servicio.

```bash
cd /opt/7wp-omc-control
pnpm drizzle-kit migrate
pnpm build
mkdir -p dist/public/manus-storage
cp deployment-assets/7wp-omc-sevilla.jpg dist/public/manus-storage/7wp-omc-sevilla_f7fdcaf6.jpg
sudo systemctl daemon-reload
sudo systemctl enable --now omc7wp
```

La copia del recurso visual sitúa la ilustración de bienvenida dentro del paquete estático de la aplicación. Las tareas y miembros del Excel se incorporan automáticamente en el primer acceso autenticado. La importación es idempotente: no duplica las 152 tareas si ya existe una matriz en la base de datos.

### 5. Publicar tras Nginx

El proxy inverso debe pasar las peticiones de la aplicación Node.js y preservar los encabezados HTTPS.

```nginx
server {
    listen 443 ssl http2;
    server_name congreso.su-dominio.es;

    ssl_certificate     /etc/letsencrypt/live/congreso.su-dominio.es/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/congreso.su-dominio.es/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Administración inicial

El primer administrador es el titular de la configuración de OAuth. Desde **Personas y permisos**, cree los perfiles de los miembros con su dirección de correo definitiva. Asigne el perfil antes de que la persona se conecte. Para convertir a una persona existente en administradora, cambie su perfil a **Administración** desde la misma vista.

Antes de iniciar el trabajo compartido, se recomienda registrar la próxima reunión del comité local y abrir las fichas de los bloques prioritarios. El correo de trabajo señala la necesidad de producir una versión agregada en inglés. La aplicación permite crear un registro de documento para esa versión y asociarlo a las tareas de comunicación, programa y publicaciones correspondientes.

## Operación, copias y actualizaciones

La información viva se encuentra en MySQL/TiDB. Realice una copia diaria de la base de datos y una copia previa a cualquier actualización. El código fuente y la carpeta `drizzle/migrations` deben conservarse junto con la copia. Una actualización estándar consiste en guardar copia, desplegar el nuevo código, ejecutar `pnpm drizzle-kit migrate`, compilar con `pnpm build` y reiniciar el servicio.

La esquina inferior del menú muestra el número de versión y la fecha/hora de compilación de la interfaz. Esta referencia debe actualizarse en cada despliegue relevante para facilitar la verificación por parte del comité.

## Validación incluida

La implementación se ha validado con `pnpm test`, que confirma la conservación de las 152 tareas, la unicidad de sus códigos, la identificación de las 64 tareas locales y la carga de los miembros organizadores iniciales. La comprobación de TypeScript y la compilación de producción concluyeron sin errores.

## References

[1]: https://nodejs.org/learn/command-line/how-to-read-environment-variables-from-nodejs "How to read environment variables from Node.js"
