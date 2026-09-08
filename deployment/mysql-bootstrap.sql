-- Ejecutar una sola vez como administrador de MySQL en el VPS.
-- Sustituir CAMBIAR_POR_CLAVE_MUY_ROBUSTA antes de ejecutar.

CREATE DATABASE IF NOT EXISTS gestor_congresos
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'gestor_app'@'127.0.0.1'
  IDENTIFIED BY 'CAMBIAR_POR_CLAVE_MUY_ROBUSTA';

GRANT ALL PRIVILEGES ON gestor_congresos.* TO 'gestor_app'@'127.0.0.1';
FLUSH PRIVILEGES;

-- Después, desde la carpeta de la aplicación:
-- DATABASE_URL='mysql://gestor_app:CAMBIAR_POR_CLAVE_MUY_ROBUSTA@127.0.0.1:3306/gestor_congresos' pnpm drizzle-kit migrate
