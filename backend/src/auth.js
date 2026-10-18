const jwt = require('jsonwebtoken');

// Visitante, token caducado o alterado: 401
function requiereSesion(req, res, next) {
  const cabecera = req.headers.authorization || '';
  const [tipo, token] = cabecera.split(' ');
  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Se requiere iniciar sesión' });
  }
  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o caducado' });
  }
}

module.exports = { requiereSesion };
