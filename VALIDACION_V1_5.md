# Validación v1.5

La versión v1.5 se validó el 8 de septiembre de 2026. Se comprobó que las tareas importadas conservan los campos de la matriz Excel: fase, comité responsable y módulo de plataforma. La interfaz ahora muestra fase y comité en el listado, y permite editar o asignar fase, comité, módulo, tipo de publicación, prioridad y categoría directamente desde cada tarea. Los catálogos de Configuración alimentan estos campos y los formularios de creación de tareas.

Se guardó una configuración SMTP temporal con host, puerto, usuario, remitente y contraseña cifrada. Después de recargar la aplicación, la alerta de SMTP pendiente dejó de mostrarse. La consulta de validación confirmó que el host, el remitente y una contraseña cifrada permanecían guardados. Posteriormente se eliminó la configuración temporal y la cuenta temporal de prueba; no se enviaron correos.

La biblioteca del congreso contiene tres documentos iniciales: la matriz Excel original, una plantilla bilingüe de acta y un presupuesto preliminar editable. Se verificó que las tres fichas documentales están asociadas al congreso 7WP&OMC. Las pruebas automatizadas, TypeScript y la compilación de producción se ejecutaron correctamente.
