USE app_vuln;
 
CREATE TABLE IF NOT EXISTS categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  nombre VARCHAR(60) NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_categoria_usuario (usuario_id, nombre)
);
 
ALTER TABLE productos ADD COLUMN IF NOT EXISTS categoria_id INT NULL;
ALTER TABLE productos ADD CONSTRAINT fk_productos_categoria
  FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL;
 
CREATE TABLE IF NOT EXISTS movimientos_stock (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  usuario_id INT NOT NULL,
  tipo ENUM('entrada', 'salida') NOT NULL,
  cantidad INT NOT NULL,
  motivo VARCHAR(200),
  stock_resultante INT NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
 
CREATE TABLE IF NOT EXISTS auditoria (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NULL,
  username VARCHAR(50),
  accion VARCHAR(50) NOT NULL,
  entidad VARCHAR(50),
  entidad_id INT,
  detalle VARCHAR(500),
  ip VARCHAR(45),
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);
 
CREATE INDEX idx_auditoria_usuario ON auditoria(usuario_id, creado_en);
CREATE INDEX idx_movimientos_producto ON movimientos_stock(producto_id, creado_en);