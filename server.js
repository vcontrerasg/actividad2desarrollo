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
  user: process.env.DB_USER || 'app_vuln',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'app_vuln',
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


// Ejecuta una consulta parametrizada y libera la conexion
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

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  });

// ---------- Autenticacion ----------
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
  res.status(201).json({ ok: true });
}));

app.post('/api/login', wrap(async (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string')
    return res.status(400).json({ error: 'Datos invalidos' });

  const [user] = await query('SELECT id, username, password_hash FROM usuarios WHERE username = ?', [username]);
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Error interno' });
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ username: user.username });
  });
}));

app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get('/api/me', (req, res) =>
  req.session.userId ? res.json({ username: req.session.username }) : res.status(401).json({ error: 'No autenticado' }));

// ---------- CRUD de productos ----------
function validarProducto(b) {
  const { nombre, descripcion = '', precio, stock } = b;
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.length > 100) return null;
  if (typeof descripcion !== 'string' || descripcion.length > 1000) return null;
  const p = Number(precio), s = Number(stock);
  if (!Number.isFinite(p) || p < 0 || !Number.isInteger(s) || s < 0) return null;
  return [nombre.trim(), descripcion, p, s];
}

app.get('/api/productos', requireAuth, wrap(async (req, res) => {
  res.json(await query('SELECT id, nombre, descripcion, precio, stock FROM productos WHERE usuario_id = ? ORDER BY id DESC', [req.session.userId]));
}));

app.post('/api/productos', requireAuth, wrap(async (req, res) => {
  const v = validarProducto(req.body);
  if (!v) return res.status(400).json({ error: 'Datos de producto invalidos' });
  const r = await query('INSERT INTO productos (usuario_id, nombre, descripcion, precio, stock) VALUES (?, ?, ?, ?, ?)', [req.session.userId, ...v]);
  res.status(201).json({ id: r.insertId });
}));

app.put('/api/productos/:id', requireAuth, wrap(async (req, res) => {
  const v = validarProducto(req.body);
  if (!v) return res.status(400).json({ error: 'Datos de producto invalidos' });
  const r = await query('UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, stock = ? WHERE id = ? AND usuario_id = ?', [...v, req.params.id, req.session.userId]);
  if (!r.affectedRows) return res.status(404).json({ error: 'No encontrado' });
  res.json({ ok: true });
}));

app.delete('/api/productos/:id', requireAuth, wrap(async (req, res) => {
  const r = await query('DELETE FROM productos WHERE id = ? AND usuario_id = ?', [req.params.id, req.session.userId]);
  if (!r.affectedRows) return res.status(404).json({ error: 'No encontrado' });
  res.json({ ok: true });
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
