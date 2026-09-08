# Gestor de congresos y tareas compartidas

**Versión v1.1 · 08/09/2026 16:16**

## Finalidad

Esta aplicación es un gestor reutilizable para organizar congresos futuros. Cada congreso tiene sus propias categorías, grupos de trabajo y tareas. Las personas se mantienen como directorio común. Un organizador administrador puede asignar una tarea a una o varias personas, a uno o varios grupos, o a una combinación de ambas opciones.

El congreso inicial, **7th World P&OM Conference**, conserva las 152 tareas importadas del Excel de origen. La información previa se transforma en una base de partida. Los futuros congresos se crean vacíos y no heredan tareas por defecto.

| Elemento | Uso |
|---|---|
| Congreso | Contenedor independiente de tareas, categorías y grupos. |
| Categoría | Clasificación simple de tareas, por ejemplo Logística, Comunicación o Programa. |
| Persona | Miembro del directorio que puede iniciar sesión y recibir tareas. |
| Grupo | Conjunto de personas. Las tareas asignadas al grupo aparecen automáticamente a sus miembros. |
| Tarea | Actividad concreta con estado, prioridad, avance, fecha límite y asignaciones múltiples. |

## Permisos

La plataforma usa dos niveles de acceso para mantener el manejo diario al mínimo.

| Perfil | Acceso |
|---|---|
| **Organizador administrador** | Ve y modifica todos los congresos, tareas, categorías, personas y grupos. Puede asignar y suspender accesos. |
| **Colaborador/a** | Ve sólo las tareas que tiene asignadas de forma directa o a través de un grupo. Puede actualizar el estado y el avance de esas tareas. |

> **La restricción se realiza en el servidor.** Un colaborador no puede obtener por URL ni por llamadas a la API una tarea que no esté asignada a él o a uno de sus grupos.

## Flujo de trabajo recomendado

Un organizador administrador debe crear primero el congreso. Después debe añadir las personas y, si conviene, crear grupos estables como Logística, Comunicación, Programa o Patrocinio. Puede crear las categorías que permitan leer el trabajo de forma más clara. A continuación, basta con crear tareas y marcar las personas y grupos que deben recibirlas.

Una persona puede pertenecer a varios grupos. Una tarea puede tener varias personas asignadas y varios grupos asignados. Por ello no hace falta duplicar una tarea cuando participan varios responsables.

## Crear un congreso futuro

Abra **Congresos** desde el menú lateral y seleccione **Nuevo congreso**. Indique el nombre, nombre corto, ciudad y fechas. Después seleccione ese congreso en el selector de la parte superior de la página. Desde ese momento, las categorías, grupos y tareas que cree pertenecen sólo al nuevo congreso.

## Instalación en servidor propio

La aplicación usa Node.js, React, Express, tRPC, Drizzle ORM y MySQL/TiDB. Requiere Node.js 22 o superior, `pnpm`, una base de datos MySQL compatible, HTTPS y un proveedor OAuth/OpenID Connect. Node.js publica la configuración recibida por el proceso mediante `process.env`. [1]

```bash
cd /opt/gestor-congresos
corepack enable
pnpm install --frozen-lockfile
pnpm drizzle-kit migrate
pnpm build
```

Configure el servicio con las variables siguientes. No guarde credenciales reales en el repositorio.

```ini
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://gestor_app:CONTRASENA@127.0.0.1:3306/gestor_congresos
JWT_SECRET=SECRETO_LARGO_Y_ALEATORIO
VITE_APP_ID=IDENTIFICADOR_OAUTH
OAUTH_SERVER_URL=https://su-proveedor-de-identidad.example
VITE_OAUTH_PORTAL_URL=https://su-proveedor-de-identidad.example
```

El proveedor de identidad debe autorizar la URL de retorno `https://congreso.su-dominio.es/api/oauth/callback`. La instalación puede utilizar la plantilla `deployment/omc7wp.service` como punto de partida y la configuración `deployment/nginx-omc7wp.conf` como proxy HTTPS. Ajuste el nombre de dominio, el usuario de servicio y todas las credenciales antes de activarlos.

## Conservación y actualización

La información compartida se guarda en MySQL/TiDB. Realice una copia de seguridad diaria de esa base de datos. Antes de actualizar la aplicación, copie la base de datos, despliegue el código nuevo, ejecute `pnpm drizzle-kit migrate`, compile con `pnpm build` y reinicie el servicio.

## Validación incluida

La implementación conserva las pruebas de autenticación e integridad de la matriz de origen. También incorpora pruebas del modelo de permisos simplificado. La compilación de TypeScript y la compilación de producción se verifican antes de cada versión.

## References

[1]: https://nodejs.org/learn/command-line/how-to-read-environment-variables-from-nodejs "How to read environment variables from Node.js"
