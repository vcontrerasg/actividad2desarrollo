CREATE DATABASE IF NOT EXISTS app_vuln CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE app_vuln;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS productos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  precio DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Usuario dedicado con privilegios minimos (cambia la clave):
-- CREATE USER 'app_vuln'@'localhost' IDENTIFIED BY 'cambia_esta_clave';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON app_vuln.* TO 'app_vuln'@'localhost';
