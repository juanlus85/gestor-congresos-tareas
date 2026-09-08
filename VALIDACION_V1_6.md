# Validación v1.6

La captura aportada identificó una ficha de tarea excesivamente densa: los campos de metadatos de importación —fase, comité, módulo y publicación— competían visualmente con las asignaciones. La ficha se rediseñó para mostrar sólo **título, descripción, estado, prioridad, categoría, fecha límite y avance**. La coordinación queda en un panel independiente de personas y grupos que se abre únicamente al pulsar **Modificar**.

La prueba autenticada se realizó con una cuenta administradora temporal. El acceso se completó y el listado mostró las 152 tareas con sus asignaciones efectivas. Al abrir la tarea «Constituir o confirmar Comité Científico», la ficha corrigió el ancho heredado del diálogo y presentó el formulario de forma clara: datos operativos a la izquierda y una síntesis de personas/grupos a la derecha. Los controles para cambiar asignaciones no se despliegan hasta solicitarlo expresamente.

Se añadió una prueba automática para garantizar que un colaborador recibe las tareas asignadas directamente y las de sus grupos, pero no las de grupos a los que no pertenece. La cuenta temporal se eliminará antes de guardar la versión final.
