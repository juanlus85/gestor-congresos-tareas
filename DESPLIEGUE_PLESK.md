# Despliegue sencillo en Plesk Node.js

**Versión:** 1.6.  
**Autor:** Manus AI.

Esta aplicación se ejecuta como Node.js, no como un sitio PHP ni como una página estática. El repositorio puede estar dentro de `httpdocs/gestor-congresos`, pero la raíz de documentos debe apuntar a los archivos construidos en `dist/public`.

## Configuración del panel Plesk

En **Websites & Domains → Node.js**, configure estos cuatro campos. Sustituya la ruta base por la que muestra su propio panel; en el servidor mostrado corresponde a `/var/www/vhosts/blancoguzman.es/httpdocs/gestor-congresos`.

| Campo de Plesk | Valor |
|---|---|
| **Application Root / Raíz de aplicación** | `/var/www/vhosts/blancoguzman.es/httpdocs/gestor-congresos` |
| **Document Root / Raíz de documentos** | `/var/www/vhosts/blancoguzman.es/httpdocs/gestor-congresos/dist/public` |
| **Application Startup File / Archivo de inicio** | `app.js` |
| **Node.js Version** | 22.x |
| **Application Mode / Modo de aplicación** | Production |

La raíz de documentos debe estar dentro de la raíz de aplicación. Por ello, no use `httpdocs` como raíz de documentos de esta aplicación; use `dist/public`.

## Variables de entorno

Mantenga las variables ya creadas en Plesk. Es imprescindible que `DATABASE_URL` tenga la forma siguiente, reemplazando la contraseña por la real:

```text
mysql://congreso:CONTRASENA@localhost:3306/congreso
```

También deben existir `JWT_SECRET`, `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, `NODE_ENV=production` y `DOCUMENTS_DIRECTORY`. El valor de `JWT_SECRET` debe tener al menos 32 caracteres. Defina `DOCUMENTS_DIRECTORY` como una ruta que pueda escribir el usuario del dominio, por ejemplo:

```text
/var/www/vhosts/blancoguzman.es/httpdocs/gestor-congresos/storage/documents
```

## Primera instalación

En SSH, dentro de la carpeta clonada, actualice el código e implemente el build. Este comando incorpora el script `migrate` y el archivo de inicio `app.js` necesarios para Plesk.

```bash
cd /var/www/vhosts/blancoguzman.es/httpdocs/gestor-congresos
git pull origin main
pnpm install --frozen-lockfile
pnpm build
```

Después, en Plesk, siga esta secuencia: **NPM Install**, **Run script** con el texto exacto `migrate`, y finalmente **Restart App**. El script de migración se ejecuta desde Plesk para que reciba las variables configuradas en el panel, incluida `DATABASE_URL`.

## Actualizaciones posteriores

Para actualizar, ejecute el mismo `git pull`, `pnpm install --frozen-lockfile` y `pnpm build` por SSH. Después pulse **Restart App** en Plesk. Si la actualización contiene cambios de base de datos, ejecute también el script `migrate` desde Plesk antes de reiniciar.

## Diagnóstico

Si Plesk sigue mostrando `Missing script: "migrate"`, el servidor no ha descargado aún la versión más reciente. Compruébelo por SSH:

```bash
cd /var/www/vhosts/blancoguzman.es/httpdocs/gestor-congresos
git log -1 --oneline
grep -n '"migrate"' package.json
```

El segundo comando debe mostrar una línea con `"migrate": "drizzle-kit migrate"`. Si no aparece, repita `git pull origin main`.

## Referencias

[1]: https://docs.plesk.com/en-US/obsidian/administrator-guide/website-management/hosting-nodejs-applications.76652/ "Plesk Hosting Node.js Applications"
