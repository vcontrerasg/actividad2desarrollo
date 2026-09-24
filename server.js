require('dotenv').config();
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const mariadb = require('mariadb');

const app = express();
app.disable('x-powered-by');
const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'app_vuln',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'app_vuln',
  allowPublicKeyRetrieval: true,     
  connectionLimit: 5,
  insertIdAsNumber: true,
  bigIntAsNumber: true,
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 },
}));


async function query(sql, params) {
  let conn;
  try {
    conn = await pool.getConnection();
    return await conn.query(sql, params);
  } finally {
    if (conn) conn.release();
  }
}

const requireAuth = (req, res, next) =>
  req.session.userId ? next() : res.status(401).json({ error: 'No autenticado' });

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  });

async function tx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Registra una accion en la tabla auditoria. Nunca debe romper la operacion principal.
async function auditar(req, accion, entidad = null, entidadId = null, detalle = null, usuario = null) {
  try {
    const userId = usuario ? usuario.id : req.session.userId ?? null;
    const username = usuario ? usuario.username : req.session.username ?? null;
    await query(
      'INSERT INTO auditoria (usuario_id, username, accion, entidad, entidad_id, detalle, ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, username && username.slice(0, 50), accion, entidad, entidadId, detalle && detalle.slice(0, 500), (req.ip || '').slice(0, 45)],
    );
  } catch (err) {
    console.error('No se pudo registrar auditoria:', err);
  }
}

function parseId(valor) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Id invalido');
  return n;
}


app.post('/api/registro', wrap(async (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || !/^[\w.-]{3,50}$/.test(username))
    return res.status(400).json({ error: 'Usuario invalido (3-50 caracteres)' });
  if (typeof password !== 'string' || password.length < 8)
    return res.status(400).json({ error: 'La contrasena debe tener al menos 8 caracteres' });

  const hash = await bcrypt.hash(password, 12);
  try {
    await query('INSERT INTO usuarios (username, password_hash) VALUES (?, ?)', [username, hash]);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El usuario ya existe' });
    throw e;
  }
  await auditar(req, 'registro', 'usuario', null, `Usuario ${username} registrado`, { id: null, username });
  res.status(201).json({ ok: true });
}));

app.post('/api/login', wrap(async (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string')
    return res.status(400).json({ error: 'Datos invalidos' });

  const [user] = await query('SELECT id, username, password_hash FROM usuarios WHERE username = ?', [username]);
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) {
    await auditar(req, 'login_fallido', 'usuario', null, 'Credenciales incorrectas', { id: null, username });
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Error interno' });
    req.session.userId = user.id;
    req.session.username = user.username;
    auditar(req, 'login', 'usuario', user.id).finally(() => res.json({ username: user.username }));
  });
}));

app.post('/api/logout', wrap(async (req, res) => {
  if (req.session.userId) await auditar(req, 'logout', 'usuario', req.session.userId);
  req.session.destroy(() => res.json({ ok: true }));
}));

app.get('/api/me', (req, res) =>
  req.session.userId ? res.json({ username: req.session.username }) : res.status(401).json({ error: 'No autenticado' }));

function validarProducto(b) {
  const { nombre, descripcion = '', precio, stock, categoriaId } = b;
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.length > 100) return null;
  if (typeof descripcion !== 'string' || descripcion.length > 1000) return null;
  const p = Number(precio), s = Number(stock);
  if (!Number.isFinite(p) || p < 0 || !Number.isInteger(s) || s < 0) return null;
  let cat = null;
  if (categoriaId !== undefined && categoriaId !== null && categoriaId !== '') {
    cat = Number(categoriaId);
    if (!Number.isInteger(cat) || cat <= 0) return null;
  }
  return [nombre.trim(), descripcion, p, s, cat];
}

// Verifica que la categoria (si viene) pertenezca al usuario autenticado.
async function verificarCategoria(categoriaId, userId) {
  if (categoriaId === null) return;
  const [cat] = await query('SELECT id FROM categorias WHERE id = ? AND usuario_id = ?', [categoriaId, userId]);
  if (!cat) throw new HttpError(400, 'Categoria invalida');
}

// ---------- Categorias ----------
app.get('/api/categorias', requireAuth, wrap(async (req, res) => {
  res.json(await query('SELECT id, nombre FROM categorias WHERE usuario_id = ? ORDER BY nombre', [req.session.userId]));
}));

app.post('/api/categorias', requireAuth, wrap(async (req, res) => {
  const { nombre } = req.body;
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 60)
    return res.status(400).json({ error: 'Nombre de categoria invalido (1-60 caracteres)' });
  let r;
  try {
    r = await query('INSERT INTO categorias (usuario_id, nombre) VALUES (?, ?)', [req.session.userId, nombre.trim()]);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'La categoria ya existe' });
    throw e;
  }
  await auditar(req, 'crear', 'categoria', r.insertId, nombre.trim());
  res.status(201).json({ id: r.insertId });
}));

app.delete('/api/categorias/:id', requireAuth, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const r = await query('DELETE FROM categorias WHERE id = ? AND usuario_id = ?', [id, req.session.userId]);
  if (!r.affectedRows) return res.status(404).json({ error: 'No encontrada' });
  await auditar(req, 'eliminar', 'categoria', id);
  res.json({ ok: true });
}));

// ---------- Productos ----------
app.get('/api/productos', requireAuth, wrap(async (req, res) => {
  res.json(await query(
    `SELECT p.id, p.nombre, p.descripcion, p.precio, p.stock, p.categoria_id AS categoriaId, c.nombre AS categoria
       FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE p.usuario_id = ? ORDER BY p.id DESC`,
    [req.session.userId],
  ));
}));

app.post('/api/productos', requireAuth, wrap(async (req, res) => {
  const v = validarProducto(req.body);
  if (!v) return res.status(400).json({ error: 'Datos de producto invalidos' });
  await verificarCategoria(v[4], req.session.userId);
  const r = await query('INSERT INTO productos (usuario_id, nombre, descripcion, precio, stock, categoria_id) VALUES (?, ?, ?, ?, ?, ?)', [req.session.userId, ...v]);
  await auditar(req, 'crear', 'producto', r.insertId, v[0]);
  res.status(201).json({ id: r.insertId });
}));

app.put('/api/productos/:id', requireAuth, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const v = validarProducto(req.body);
  if (!v) return res.status(400).json({ error: 'Datos de producto invalidos' });
  await verificarCategoria(v[4], req.session.userId);
  const r = await query('UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, stock = ?, categoria_id = ? WHERE id = ? AND usuario_id = ?', [...v, id, req.session.userId]);
  if (!r.affectedRows) return res.status(404).json({ error: 'No encontrado' });
  await auditar(req, 'editar', 'producto', id, v[0]);
  res.json({ ok: true });
}));

app.delete('/api/productos/:id', requireAuth, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const r = await query('DELETE FROM productos WHERE id = ? AND usuario_id = ?', [id, req.session.userId]);
  if (!r.affectedRows) return res.status(404).json({ error: 'No encontrado' });
  await auditar(req, 'eliminar', 'producto', id);
  res.json({ ok: true });
}));

// ---------- Movimientos de stock ----------
app.get('/api/productos/:id/movimientos', requireAuth, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const [prod] = await query('SELECT id FROM productos WHERE id = ? AND usuario_id = ?', [id, req.session.userId]);
  if (!prod) return res.status(404).json({ error: 'No encontrado' });
  res.json(await query(
    `SELECT id, tipo, cantidad, motivo, stock_resultante AS stockResultante, creado_en AS creadoEn
       FROM movimientos_stock WHERE producto_id = ? AND usuario_id = ? ORDER BY id DESC LIMIT 100`,
    [id, req.session.userId],
  ));
}));

app.post('/api/productos/:id/movimientos', requireAuth, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const { tipo, cantidad, motivo = '' } = req.body;
  const cant = Number(cantidad);
  if (tipo !== 'entrada' && tipo !== 'salida') return res.status(400).json({ error: 'Tipo de movimiento invalido' });
  if (!Number.isInteger(cant) || cant <= 0) return res.status(400).json({ error: 'La cantidad debe ser un entero mayor a 0' });
  if (typeof motivo !== 'string' || motivo.length > 200) return res.status(400).json({ error: 'Motivo invalido (max. 200 caracteres)' });

  const stock = await tx(async (conn) => {
    const [prod] = await conn.query('SELECT stock FROM productos WHERE id = ? AND usuario_id = ? FOR UPDATE', [id, req.session.userId]);
    if (!prod) throw new HttpError(404, 'No encontrado');
    const nuevo = tipo === 'entrada' ? prod.stock + cant : prod.stock - cant;
    if (nuevo < 0) throw new HttpError(400, 'Stock insuficiente para el retiro');
    await conn.query('UPDATE productos SET stock = ? WHERE id = ?', [nuevo, id]);
    await conn.query(
      'INSERT INTO movimientos_stock (producto_id, usuario_id, tipo, cantidad, motivo, stock_resultante) VALUES (?, ?, ?, ?, ?, ?)',
      [id, req.session.userId, tipo, cant, motivo.trim() || null, nuevo],
    );
    return nuevo;
  });
  await auditar(req, tipo, 'producto', id, `${tipo} de ${cant} unidades. Stock: ${stock}`);
  res.status(201).json({ stock });
}));

// ---------- Auditoria ----------
app.get('/api/auditoria', requireAuth, wrap(async (req, res) => {
  res.json(await query(
    `SELECT id, accion, entidad, entidad_id AS entidadId, detalle, creado_en AS creadoEn
       FROM auditoria WHERE usuario_id = ? ORDER BY id DESC LIMIT 50`,
    [req.session.userId],
  ));
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
