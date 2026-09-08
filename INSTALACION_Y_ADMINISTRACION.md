# Gestor de congresos y tareas compartidas

**Versión v1.2 · 08/09/2026 16:34**

## Finalidad

La aplicación permite coordinar uno o varios congresos desde un único espacio. Cada congreso conserva sus propias categorías, grupos y tareas. Las personas pertenecen al directorio común. Un organizador administrador puede crear cuentas, editar perfiles y asignar una tarea a una o varias personas, a uno o varios grupos, o a una combinación de ambos.

El 7th World P&OM Conference continúa disponible como congreso inicial con sus 152 tareas importadas. Los siguientes congresos se crean vacíos, de forma independiente y reutilizable.

| Elemento | Uso |
|---|---|
| Congreso | Contenedor independiente de categorías, grupos y tareas. |
| Categoría | Clasificación de tareas de un congreso, por ejemplo Logística, Comunicación o Programa. |
| Persona | Perfil con nombre, correo, clave, cargo, posición, organización, teléfono y notas. |
| Grupo | Conjunto de personas. Una tarea asignada a un grupo aparece a todos sus miembros. |
| Tarea | Actividad con estado, prioridad, avance, fecha límite y asignaciones múltiples. |
| Configuración | Catálogo editable de cargos, posiciones y otras opciones reutilizables. |

## Acceso con correo y clave

Cada persona usuaria accede con el correo y la clave creados por un organizador administrador. Las claves no se guardan en texto visible. La aplicación almacena una derivación criptográfica con `scrypt` y compara el resultado sin exponer la clave original.

| Perfil | Acceso |
|---|---|
| **Organizador administrador** | Puede ver y modificar todos los congresos, tareas, categorías, personas, cargos, posiciones y grupos. Puede crear cuentas, cambiar claves y suspender el acceso. |
| **Colaborador/a** | Sólo ve las tareas asignadas directamente a su perfil o a uno de los grupos de los que forma parte. Puede actualizar el estado y el avance de sus tareas. |

> **La comprobación de permisos se realiza en el servidor.** Un colaborador no puede acceder por URL o API a tareas que no se hayan asignado a su perfil o a uno de sus grupos.

## Administración diaria

El menú **Personas** permite crear una cuenta con correo y clave. También permite editar el nombre, cargo, posición, organización, teléfono, notas, perfil y estado de acceso de una persona. Al editar una cuenta, una nueva clave es opcional. Si se deja vacía, la clave existente no cambia.

El menú **Grupos** permite crear grupos y añadir o quitar varias personas en una única operación. El menú **Categorías** permite crear y editar las categorías del congreso activo. El menú **Configuración** gestiona el catálogo de cargos y posiciones que aparece como sugerencia al editar los perfiles.

Para dar trabajo a una persona, abra una tarea desde **Todas las tareas**. Marque todas las personas y grupos que deban recibirla y seleccione **Aplicar asignaciones**. No es necesario duplicar la tarea para varios responsables.

## Crear un congreso futuro

Abra **Congresos** y seleccione **Nuevo congreso**. Indique el nombre, la abreviatura, la ciudad y las fechas. Después active ese congreso desde el selector superior. Cree allí sus categorías y grupos. Las tareas, las categorías y los grupos quedarán separados de los del 7WP&OMC.

## Instalación en servidor propio

La aplicación usa Node.js, React, Express, tRPC, Drizzle ORM y MySQL/TiDB. Requiere Node.js 22 o superior, `pnpm`, una base de datos MySQL compatible y HTTPS. Node.js publica las variables recibidas por el proceso mediante `process.env`. [1]

```bash
cd /opt/gestor-congresos
corepack enable
pnpm install --frozen-lockfile
pnpm drizzle-kit migrate
pnpm build
```

Defina las variables de entorno del servicio. Use valores reales y mantenga los secretos fuera del repositorio.

```ini
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://gestor_app:CONTRASENA@127.0.0.1:3306/gestor_congresos
JWT_SECRET=SECRETO_LARGO_Y_ALEATORIO_DE_AL_MENOS_32_CARACTERES
INITIAL_ADMIN_NAME=Nombre del administrador inicial
INITIAL_ADMIN_EMAIL=admin@su-organizacion.es
INITIAL_ADMIN_PASSWORD=ClaveInicialSegura2027
```

En el primer arranque, si no existe una persona con `INITIAL_ADMIN_EMAIL`, la aplicación crea esa cuenta como **organizador administrador**. Esta es la cuenta desde la que deben crearse los demás usuarios. Cambie la clave inicial en cuanto se compruebe el acceso y retire `INITIAL_ADMIN_PASSWORD` del servicio después de ese primer inicio.

La aplicación mantiene un acceso alternativo con SSO para la vista previa. En un servidor propio no es necesario configurar OAuth para utilizar las cuentas locales. Si se desea habilitar además SSO institucional, configure `VITE_APP_ID`, `OAUTH_SERVER_URL` y `VITE_OAUTH_PORTAL_URL` con el proveedor correspondiente.

## Proxy HTTPS

Utilice Nginx o un proxy inverso equivalente para publicar el servicio Node.js mediante HTTPS. La plantilla `deployment/nginx-omc7wp.conf` debe ajustarse con el dominio y certificado reales. El proxy debe reenviar los encabezados `Host` y `X-Forwarded-Proto`, ya que permiten que la cookie de sesión use el modo seguro.

## Copias y actualizaciones

La información se guarda en MySQL/TiDB. Realice una copia de seguridad diaria de la base de datos. Antes de actualizar el software, haga una copia, despliegue el código nuevo, ejecute `pnpm drizzle-kit migrate`, compile con `pnpm build` y reinicie el servicio.

## Validación incluida

La versión incluye pruebas de integridad de las tareas importadas, comprobación de los permisos simplificados, autenticación y cierre de sesión, así como validación de claves mediante hash. Antes de liberar la versión se ejecutaron las pruebas, la comprobación de TypeScript y la compilación de producción.

## References

[1]: https://nodejs.org/learn/command-line/how-to-read-environment-variables-from-nodejs "How to read environment variables from Node.js"
