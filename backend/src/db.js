const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function iniciar(intentos = 10) {
  for (let i = 1; i <= intentos; i++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          creado_en TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS lugares (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(120) NOT NULL,
          edificio VARCHAR(60) NOT NULL,
          piso INTEGER NOT NULL,
          descripcion TEXT DEFAULT '',
          creado_en TIMESTAMP DEFAULT NOW()
        );
      `);
      return;
    } catch (err) {
      console.log(`Esperando la base de datos (${i}/${intentos})...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('No se pudo conectar a la base de datos');
}

module.exports = { pool, iniciar };
