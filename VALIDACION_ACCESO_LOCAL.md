# Validación de acceso local v1.4

La pantalla de acceso se abrió en la vista previa el 8 de septiembre de 2026. El formulario presenta los campos de correo y clave. Se creó una cuenta temporal activa con un hash `scrypt` compatible para comprobar el envío de la cookie de sesión tras el ajuste de `JWT_SECRET` de desarrollo.

La primera comprobación de extremo a extremo identificó que la vista previa sí define `JWT_SECRET`, pero con una longitud inferior a 32 caracteres. La lógica de desarrollo trataba esa variable como válida por estar presente, en vez de sustituirla por la clave efímera de desarrollo. Se corrigió para que, fuera de producción, use la clave efímera cuando el valor configurado sea ausente o demasiado corto.

La validación final se realizó con la cuenta temporal `validacion.local@ejemplo.es`. El inicio de sesión se completó correctamente, se creó la sesión y el panel mostró el perfil **Colaborador/a**, el menú restringido a **Mis tareas** y **Documentos**, y cero tareas asignadas. Esto confirma el comportamiento de acceso por perfil.

La cuenta temporal será retirada al cerrar la comprobación. No se usa para operación ni contiene datos reales.
