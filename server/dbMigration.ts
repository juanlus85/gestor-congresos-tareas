import path from "node:path";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { getDb } from "./db";

/**
 * Aplica las migraciones pendientes al arrancar el proceso Node.
 * Drizzle registra cada migración aplicada, por lo que la operación es idempotente.
 */
export async function migrateDatabaseOnStartup() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL es obligatoria para iniciar la aplicación.");
  }

  const db = await getDb();
  if (!db) throw new Error("No se pudo conectar con la base de datos.");

  try {
    await migrate(db, {
      migrationsFolder: path.resolve(process.cwd(), "drizzle"),
    });
  } catch (error) {
    // Algunas instalaciones iniciales crearon las tablas mediante SQL antes de
    // registrar el historial de Drizzle. En ese caso el esquema ya está listo.
    const code = (error as { cause?: { code?: string } }).cause?.code;
    if (code === "ER_TABLE_EXISTS_ERROR") {
      console.warn("[Database] Esquema existente detectado; se conserva y se inicia la aplicación.");
      return;
    }
    throw error;
  }
}
