const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, iniciar } = require('./db');
const { requiereSesion } = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

const emailValido = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// ---------- Registro e inicio de sesión ----------
app.post('/registro', async (req, res) => {
  const { email, password } = req.body || {};
  if (!emailValido(email)) return res.status(400).json({ error: 'Correo inválido' });
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      'INSERT INTO usuarios (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email.toLowerCase(), hash]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Ese correo ya está registrado' });
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!emailValido(email) || typeof password !== 'string') {
    return res.status(400).json({ error: 'Correo o contraseña faltantes' });
  }
  try {
    const r = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email.toLowerCase()]);
    const u = r.rows[0];
    if (!u || !(await bcrypt.compare(password, u.password_hash))) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    const token = jwt.sign({ id: u.id, email: u.email }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    });
    res.status(200).json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ---------- CRUD de lugares (requiere sesión) ----------
function validarLugar(body) {
  const { nombre, edificio, piso } = body || {};
  if (typeof nombre !== 'string' || !nombre.trim()) return 'El nombre es obligatorio';
  if (typeof edificio !== 'string' || !edificio.trim()) return 'El edificio es obligatorio';
  if (!Number.isInteger(piso)) return 'El piso debe ser un número entero';
  return null;
}

app.post('/lugares', requiereSesion, async (req, res) => {
  const error = validarLugar(req.body);
  if (error) return res.status(400).json({ error });
  const { nombre, edificio, piso, descripcion = '' } = req.body;
  const r = await pool.query(
    'INSERT INTO lugares (nombre, edificio, piso, descripcion) VALUES ($1,$2,$3,$4) RETURNING *',
    [nombre.trim(), edificio.trim(), piso, descripcion]
  );
  res.status(201).json(r.rows[0]);
});

app.get('/lugares', requiereSesion, async (req, res) => {
  const r = await pool.query('SELECT * FROM lugares ORDER BY id');
  res.status(200).json(r.rows);
});

app.get('/lugares/:id', requiereSesion, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });
  const r = await pool.query('SELECT * FROM lugares WHERE id = $1', [id]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Lugar no encontrado' });
  res.status(200).json(r.rows[0]);
});

app.put('/lugares/:id', requiereSesion, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });
  const error = validarLugar(req.body);
  if (error) return res.status(400).json({ error });
  const { nombre, edificio, piso, descripcion = '' } = req.body;
  const r = await pool.query(
    'UPDATE lugares SET nombre=$1, edificio=$2, piso=$3, descripcion=$4 WHERE id=$5 RETURNING *',
    [nombre.trim(), edificio.trim(), piso, descripcion, id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Lugar no encontrado' });
  res.status(200).json(r.rows[0]);
});

app.delete('/lugares/:id', requiereSesion, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido' });
  const r = await pool.query('DELETE FROM lugares WHERE id = $1 RETURNING id', [id]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Lugar no encontrado' });
  res.status(200).json({ mensaje: 'Lugar eliminado' });
});

// Errores no controlados (por ejemplo, la base caída)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error del servidor' });
});

iniciar()
  .then(() => app.listen(5000, () => console.log('API lista en el puerto 5000')))
  .catch((e) => { console.error(e.message); process.exit(1); });
