# Gestor de congresos y tareas compartidas

**Versión v1.6 · 08/09/2026**

## Resumen operativo

La aplicación permite organizar congresos, asignar tareas a personas o grupos y comprobar su realización. Se instala de forma autónoma en un VPS con Node.js, MySQL o MariaDB, Nginx y HTTPS. Los documentos se guardan en una carpeta protegida del servidor y la base de datos conserva sus metadatos y permisos de acceso.

| Área | Capacidades incluidas |
|---|---|
| Cuentas locales | Inicio de sesión por correo y clave, con perfiles de organizador administrador y colaborador. |
| Tareas | Título, descripción, estado, prioridad, categoría, fecha límite, avance y asignación múltiple. |
| Coordinación | Las tareas se asignan a personas y grupos; los miembros de un grupo reciben sus tareas automáticamente. |
| Verificación | El colaborador solicita el cierre y el organizador confirma o devuelve la tarea. |
| Documentos | Biblioteca por congreso, subida de archivos, visibilidad y descarga protegida. |
| Correo | Envío a personas o grupos, SMTP cifrado y registro de envíos. |

## Flujo de coordinación

Una tarea se crea con sus datos esenciales. El organizador abre la ficha y usa **Modificar** en el bloque **Personas y grupos** para asignarla a una o varias personas, a uno o varios grupos, o a ambos. Las asignaciones directas y por grupo se resuelven automáticamente al mostrar el espacio de cada colaborador.

Cada colaborador puede actualizar el estado y el porcentaje de avance de las tareas que ve. Al terminarlas, las envía a verificación. La tarea no se considera resuelta hasta que un organizador la confirma desde **Verificaciones**. Las tareas resueltas se ocultan por defecto en el listado y se muestran con el control correspondiente.

## Configuración que se utiliza

La sección **Configuración** está limitada a valores que se utilizan directamente en los formularios: estados y prioridades de tareas, además de cargos y posiciones de personas. Los equipos se gestionan en **Grupos** y la clasificación del trabajo se gestiona en **Categorías**, que pertenecen a cada congreso.

> Los campos históricos de la matriz original se conservan en los datos importados, pero no se muestran ni se piden al crear una tarea. La coordinación diaria utiliza tareas, categorías, personas y grupos.

## Acceso local

Cada persona debe disponer de un correo, una clave y el estado **Activo**. La clave debe tener al menos ocho caracteres; se admite cualquier combinación de letras, números y símbolos. Si una persona importada ya existe sin clave, el administrador puede editarla y definir una contraseña usando el mismo correo; no se creará una cuenta duplicada.

| Comprobación si no inicia sesión | Acción administrativa |
|---|---|
| Correo | Revisar que coincide con el campo de correo de **Personas**. Los espacios y las mayúsculas no afectan al acceso. |
| Clave | Restablecerla desde **Editar persona**. |
| Perfil | Confirmar que la cuenta está **Activa**. Una cuenta suspendida no puede entrar. |
| HTTPS | Confirmar que se accede mediante HTTPS; las cookies de sesión son seguras. |

## Biblioteca de documentos

La sección **Documentos** permite subir actas, plantillas, presupuestos y otros materiales por congreso. Se admiten PDF, Word, Excel, PowerPoint, CSV, texto e imágenes de hasta 10 MB. Los documentos pueden ser visibles para todos los usuarios conectados, para los comités o sólo para los organizadores.

La biblioteca inicial incluye la matriz Excel original, una plantilla bilingüe de acta de reunión y un presupuesto preliminar. La descarga utiliza una ruta protegida que comprueba la sesión y el nivel de visibilidad antes de entregar el archivo.

## Mensajería y SMTP

En **Mensajes**, un organizador configura el servidor SMTP, puerto, usuario, contraseña, remitente y tipo de conexión. La contraseña se cifra antes de almacenarse y no vuelve a mostrarse en pantalla. Los demás datos permanecen visibles al abrir la configuración y la interfaz indica que ya existe una contraseña guardada.

En producción, `JWT_SECRET` debe tener al menos 32 caracteres y conservarse estable como variable del sistema. Esta clave protege las sesiones y el cifrado SMTP. Si se cambia, será necesario volver a guardar la contraseña SMTP.

## Despliegue, actualización y copias

La instalación autónoma y actualizaciones se explican en [DESPLIEGUE_VPS.md](DESPLIEGUE_VPS.md). El servicio de producción se denomina `gestor-congresos`. Las copias de seguridad deben cubrir tanto la base de datos `gestor_congresos` como la carpeta de documentos `/var/lib/gestor-congresos/documents`.

## Referencias

[1]: https://nodejs.org/api/environment_variables.html "Node.js environment variables"
[2]: https://expressjs.com/en/advanced/best-practice-security.html "Express production security best practices"
