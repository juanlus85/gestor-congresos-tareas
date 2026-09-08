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

  await migrate(db, {
    migrationsFolder: path.resolve(process.cwd(), "drizzle"),
  });
}
