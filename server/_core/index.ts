import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { getDocumentByKey, getEffectiveRole } from "../db";
import { localDocumentPath } from "../documentStorage";
import { isOrganizer } from "../permissions";
import { migrateDatabaseOnStartup } from "../dbMigration";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // La base de la vista previa se gestiona por el entorno de desarrollo.
  // En Plesk/producción, cada reinicio aplica las migraciones pendientes.
  if (process.env.NODE_ENV === "production") await migrateDatabaseOnStartup();
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.get("/documentos/:key", async (req, res) => {
    try {
      const context = await createContext({ req, res });
      if (!context.user) return res.status(401).send("Inicia sesión para acceder al documento.");
      const document = await getDocumentByKey(req.params.key);
      if (!document?.storageKey || !document.fileName) return res.status(404).send("Documento no encontrado.");
      const role = await getEffectiveRole(context.user);
      if (document.visibility === "Organizadores" && !isOrganizer(role)) return res.status(403).send("No tienes permiso para acceder a este documento.");
      res.type(document.mimeType || "application/octet-stream");
      return res.download(localDocumentPath(document.storageKey), document.fileName);
    } catch {
      return res.status(404).send("Documento no disponible.");
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  // Nginx proxies production traffic to this exact port.  In development a
  // fallback keeps the preview usable if the preferred port is occupied.
  const port = process.env.NODE_ENV === "production"
    ? preferredPort
    : await findAvailablePort(preferredPort);

  if (port !== preferredPort) console.log(`Port ${preferredPort} is busy, using port ${port} instead`);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
