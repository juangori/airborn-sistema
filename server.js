const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { Readable } = require('stream');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// ==================== CONFIGURACIÓN ====================
const DATOS_DIR = './datos';          // acá se guardan las BD por cliente: datos/<usuario>.db
const BACKUPS_DIR = './backups';      // backups por cliente: backups/<usuario>/
const USUARIOS_DB = './usuarios.db';  // BD maestra de usuarios
const CONFIG_FILE = './config.json';

// Crear carpetas necesarias
[DATOS_DIR, BACKUPS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Carpeta creada: ${dir}`);
  }
});

// ==================== MIDDLEWARE ====================
app.use(cors({ credentials: true, origin: true }));
app.use(bodyParser.json());

// Sesiones (en Railway conviene setear secret con env var)
app.use(session({
  secret: process.env.SESSION_SECRET || ('airborn-secret-key-cambiar-en-produccion-' + Date.now()),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // poner true cuando tengas HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Servir estáticos, pero NO servir index.html automáticamente
app.use(express.static('public', { index: false }));

// ==================== BASE DE DATOS DE USUARIOS ====================
const usuariosDb = new sqlite3.Database(USUARIOS_DB, (err) => {
  if (err) console.error('❌ Error abriendo BD usuarios:', err);
  else console.log('✅ BD de usuarios conectada');
});

// Crear tabla de usuarios + admin default (serializado)
usuariosDb.serialize(() => {
  usuariosDb.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nombreComercio TEXT,
      email TEXT,
      activo INTEGER DEFAULT 1,
      fechaCreacion TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('❌ Error creando tabla usuarios:', err);
  });

  const passwordAdmin = bcrypt.hashSync('admin123', 10);
  usuariosDb.run(
    `INSERT OR IGNORE INTO usuarios (usuario, password, nombreComercio) VALUES (?, ?, ?)`,
    ['admin', passwordAdmin, 'Administrador'],
    function (err) {
      if (err) {
        console.error('❌ Error creando usuario admin:', err);
        return;
      }
      if (this.changes > 0) {
        console.log('✅ Usuario admin creado (password: admin123)');
      } else {
        console.log('ℹ️ Usuario admin ya existía');
      }
    }
  );
});

// ==================== MULTI-TENANT: BD POR USUARIO ====================
const conexionesDb = {}; // cache de conexiones

function inicializarBdCliente(db) {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS productos (
        id INTEGER PRIMARY KEY,
        codigo TEXT UNIQUE NOT NULL,
        descripcion TEXT,
        categoria TEXT,
        precioPublico REAL,
        costo REAL,
        stock INTEGER DEFAULT 0
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS ventas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha DATE,
        codigoArticulo TEXT,
        cantidad INTEGER,
        precio REAL,
        descuento INTEGER DEFAULT 0,
        categoria TEXT,
        factura TEXT,
        tipoPago TEXT,
        detalles TEXT,
        caja TEXT,
        FOREIGN KEY(codigoArticulo) REFERENCES productos(codigo)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS cuentasCorrientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente TEXT UNIQUE,
        deuda REAL DEFAULT 0,
        pagos REAL DEFAULT 0
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS movimientosCuentas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente TEXT,
        tipo TEXT,
        monto REAL,
        fecha TEXT,
        comentario TEXT,
        FOREIGN KEY(cliente) REFERENCES cuentasCorrientes(cliente)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS cambios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha DATE,
        articuloDevuelto TEXT,
        articuloNuevo TEXT,
        precioDevuelto REAL,
        precioNuevo REAL,
        diferencia REAL,
        comentarios TEXT
      )
    `);
  });
}

function obtenerDbUsuario(usuario) {
  if (!usuario) return null;

  if (!conexionesDb[usuario]) {
    const rutaDb = path.join(DATOS_DIR, `${usuario}.db`);
    conexionesDb[usuario] = new sqlite3.Database(rutaDb, (err) => {
      if (err) console.error(`❌ Error abriendo BD de ${usuario}:`, err);
    });
    inicializarBdCliente(conexionesDb[usuario]);
    console.log(`📂 BD cargada para usuario: ${usuario}`);
  }

  return conexionesDb[usuario];
}

function requireAuth(req, res, next) {
  if (req.session && req.session.usuario) {
    req.db = obtenerDbUsuario(req.session.usuario);
    return next();
  }
  return res.status(401).json({ error: 'No autenticado' });
}

// ==================== UTILIDADES ====================
function cargarConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error cargando config:', e);
  }
  return { appName: 'AIRBORN' };
}

function guardarConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (e) {
    console.error('Error guardando config:', e);
    return false;
  }
}

// Precio AR: "$199.990,00" -> 199990.00
function parseARS(value) {
  if (value === null || value === undefined) return 0;
  return (
    parseFloat(
      value
        .toString()
        .replace(/\$/g, '')
        .replace(/\s/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
        .trim()
    ) || 0
  );
}

// ==================== BACKUPS (POR USUARIO) ====================
function dirBackupsUsuario(usuario) {
  return path.join(BACKUPS_DIR, usuario);
}

function crearBackup(usuario, accion, detalle = '') {
  if (!usuario) return false;

  const dirUser = dirBackupsUsuario(usuario);
  if (!fs.existsSync(dirUser)) fs.mkdirSync(dirUser, { recursive: true });

  const ahora = new Date();
  const fecha = ahora.toISOString().slice(0, 10); // YYYY-MM-DD
  const hora = ahora.toTimeString().slice(0, 8).replace(/:/g, '-'); // HH-MM-SS
  const timestamp = `${fecha}_${hora}`;
  const nombreArchivo = `${timestamp}_${accion.replace(/\s+/g, '_').substring(0, 30)}.db`;

  const rutaDb = path.join(DATOS_DIR, `${usuario}.db`);
  const rutaBackup = path.join(dirUser, nombreArchivo);

  try {
    if (!fs.existsSync(rutaDb)) return false;

    fs.copyFileSync(rutaDb, rutaBackup);

    const metadataFile = path.join(dirUser, 'metadata.json');
    let metadata = [];
    if (fs.existsSync(metadataFile)) {
      metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    }

    metadata.unshift({
      archivo: nombreArchivo,
      fecha: timestamp,
      accion,
      detalle,
      timestampMs: ahora.getTime()
    });

    // Mantener últimos 100
    if (metadata.length > 100) {
      const antiguos = metadata.splice(100);
      antiguos.forEach(b => {
        const rutaAntiguo = path.join(dirUser, b.archivo);
        if (fs.existsSync(rutaAntiguo)) fs.unlinkSync(rutaAntiguo);
      });
    }

    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    console.log(`💾 Backup (${usuario}) creado: ${nombreArchivo}`);
    return true;
  } catch (error) {
    console.error('❌ Error creando backup:', error);
    return false;
  }
}

// ==================== RUTAS PÚBLICAS ====================

// Root: si está autenticado, index.html; si no, login.html
app.get('/', (req, res) => {
  if (req.session && req.session.usuario) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  return res.redirect('/login.html');
});

// Login
app.post('/api/login', (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  usuariosDb.get(
    'SELECT * FROM usuarios WHERE usuario = ? AND activo = 1',
    [usuario.trim()],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Error BD usuarios' });
      if (!row) return res.status(401).json({ error: 'Usuario no existe' });

      const ok = bcrypt.compareSync(password, row.password);
      if (!ok) return res.status(401).json({ error: 'Contraseña incorrecta' });

      req.session.usuario = row.usuario;
      req.session.nombreComercio = row.nombreComercio || '';
      // Forzar carga de DB
      obtenerDbUsuario(row.usuario);

      // Asegurar que la sesión se guarde antes de responder (evita "login y te saca" en algunos casos)
      req.session.save(() => {
        res.json({ ok: true, usuario: row.usuario, nombreComercio: row.nombreComercio || '' });
      });
    }
  );
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Sesión actual
app.get('/api/session', (req, res) => {
  const logueado = !!(req.session && req.session.usuario);
  // OJO: el frontend (index.html/login.html) espera la key `logueado`
  return res.json({
    ok: logueado,
    logueado,
    usuario: logueado ? req.session.usuario : null,
    nombreComercio: logueado ? (req.session.nombreComercio || '') : ''
  });
});

// Crear usuario (admin only, opcional; si no lo querés, lo podés borrar)
app.post('/api/usuarios', (req, res) => {
  const { usuario, password, nombreComercio, email } = req.body || {};
  if (!usuario || !password) return res.status(400).json({ error: 'usuario y password requeridos' });

  const hash = bcrypt.hashSync(password, 10);
  usuariosDb.run(
    `INSERT INTO usuarios (usuario, password, nombreComercio, email) VALUES (?, ?, ?, ?)`,
    [usuario.trim(), hash, nombreComercio || '', email || ''],
    function (err) {
      if (err) {
        if ((err.message || '').includes('UNIQUE')) return res.status(409).json({ error: 'Usuario ya existe' });
        return res.status(500).json({ error: err.message });
      }
      res.json({ ok: true, id: this.lastID });
    }
  );
});

// ==================== ENDPOINTS (PROTEGIDOS) ====================

// 1. BÚSQUEDA DE PRODUCTOS
app.get('/api/productos/buscar', requireAuth, (req, res) => {
  const db = req.db;
  const { codigo } = req.query;

  db.get(
    'SELECT * FROM productos WHERE codigo LIKE ? LIMIT 1',
    [`%${codigo}%`],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Producto no encontrado' });
      res.json(row);
    }
  );
});

// 2. OBTENER TODOS LOS PRODUCTOS
app.get('/api/productos', requireAuth, (req, res) => {
  const db = req.db;
  db.all('SELECT * FROM productos ORDER BY descripcion', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// 3. REGISTRAR VENTA
app.post('/api/ventas', requireAuth, (req, res) => {
  const db = req.db;
  const usuario = req.session.usuario;

  const {
    fecha,
    articulo,
    cantidad,
    precio,
    descuento = 0,
    categoria,
    factura,
    tipoPago,
    comentarios
  } = req.body;

  if (!fecha || !articulo || !cantidad || !precio) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  const stmt = db.prepare(`
    INSERT INTO ventas
    (fecha, codigoArticulo, cantidad, precio, descuento, categoria, factura, tipoPago, detalles, caja)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    fecha,
    articulo,
    cantidad,
    precio,
    descuento,
    categoria || '',
    factura || 'A',
    tipoPago || '',
    comentarios || '',
    'A',
    function (err) {
      if (err) {
        console.error('Error insertando venta:', err);
        return res.status(500).json({ error: 'Error al registrar venta' });
      }

      db.run(
        'UPDATE productos SET stock = stock - ? WHERE codigo = ?',
        [cantidad, articulo],
        (err2) => {
          if (err2) {
            console.error('Error actualizando stock:', err2);
            return res.status(500).json({ error: 'Venta registrada, pero error al actualizar stock' });
          }
          crearBackup(usuario, 'Venta registrada', `Art: ${articulo}, Cant: ${cantidad}, $${precio}`);
          res.json({ ok: true, id: this.lastID });
        }
      );
    }
  );
});

// 4. OBTENER VENTAS
app.get('/api/ventas', requireAuth, (req, res) => {
  const db = req.db;
  db.all('SELECT * FROM ventas ORDER BY id DESC LIMIT 200', [], (err, rows) => {
    if (err) {
      console.error('Error leyendo ventas:', err);
      return res.status(500).json({ error: 'Error al leer ventas' });
    }

    const ventas = (rows || []).map(r => ({
      id: r.id,
      fecha: r.fecha,
      articulo: r.codigoArticulo,
      cantidad: r.cantidad,
      precio: r.precio,
      descuento: r.descuento || 0,
      categoria: r.categoria || '',
      factura: r.factura || '',
      tipoPago: r.tipoPago || '',
      comentarios: r.detalles || ''
    }));

    res.json(ventas);
  });
});

// 4b. ELIMINAR VENTA
app.delete('/api/ventas/:id', requireAuth, (req, res) => {
  const db = req.db;
  const usuario = req.session.usuario;
  const { id } = req.params;

  db.get('SELECT codigoArticulo, cantidad, precio FROM ventas WHERE id = ?', [id], (err, venta) => {
    if (err) {
      console.error('Error buscando venta:', err);
      return res.status(500).json({ error: 'Error al buscar la venta' });
    }
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

    db.run('DELETE FROM ventas WHERE id = ?', [id], function (err2) {
      if (err2) {
        console.error('Error eliminando venta:', err2);
        return res.status(500).json({ error: 'Error al eliminar la venta' });
      }

      db.run(
        'UPDATE productos SET stock = stock + ? WHERE codigo = ?',
        [venta.cantidad, venta.codigoArticulo],
        (err3) => {
          if (err3) {
            console.error('Error devolviendo stock:', err3);
            return res.json({ ok: true, warning: 'Venta eliminada pero hubo error al devolver stock' });
          }
          crearBackup(usuario, 'Venta eliminada', `Art: ${venta.codigoArticulo}, Cant: ${venta.cantidad}, $${venta.precio}`);
          res.json({ ok: true, mensaje: `Venta eliminada y ${venta.cantidad} unidades devueltas al stock` });
        }
      );
    });
  });
});

// 5. OBTENER VENTAS DEL DÍA
app.get('/api/ventas/dia/:fecha', requireAuth, (req, res) => {
  const db = req.db;
  const { fecha } = req.params;

  db.all(
    'SELECT * FROM ventas WHERE fecha = ? ORDER BY id DESC',
    [fecha],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
});

// 5b. ACTUALIZAR PRODUCTO
app.put('/api/productos/:codigo', requireAuth, (req, res) => {
  const db = req.db;
  const usuario = req.session.usuario;

  const { codigo } = req.params;
  const { precioPublico, costo, stockFinal } = req.body;

  db.run(
    'UPDATE productos SET precioPublico = ?, costo = ?, stock = ? WHERE codigo = ?',
    [precioPublico, costo, stockFinal, codigo],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
      crearBackup(usuario, 'Producto modificado', `Código: ${codigo}, Stock: ${stockFinal}, Precio: $${precioPublico}`);
      res.json({ ok: true });
    }
  );
});

// 6. UPLOAD DE CSV STOCK (corrige bug: memoryStorage -> buffer)
app.post('/api/stock/upload', requireAuth, upload.single('file'), (req, res) => {
  const db = req.db;
  const usuario = req.session.usuario;

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const results = [];
  const stream = Readable.from(req.file.buffer.toString('utf8'));

  // Detectar headers comunes: codigo, cantidad/stock
  stream
    .pipe(csv())
    .on('data', (row) => results.push(row))
    .on('end', () => {
      if (!results.length) return res.json({ message: 'Archivo vacío', procesados: 0, errores: [] });

      let processed = 0;
      const errors = [];

      results.forEach((row) => {
        const codigo = (row.codigo || row.CODIGO || row.Codigo || row['Código'] || row['CODIGO'] || '').toString().trim();
        const cantidadRaw = row.cantidad ?? row.stock ?? row.Stock ?? row.CANTIDAD ?? row['Cantidad'] ?? row['STOCK'];

        if (!codigo) {
          processed++;
          errors.push({ codigo: '', error: 'Fila sin codigo' });
          if (processed === results.length) return res.json({ message: 'Stock actualizado', procesados: results.length - errors.length, errores: errors });
          return;
        }

        const cantidad = parseInt((cantidadRaw ?? '0').toString().replace(/[^\d-]/g, ''), 10);
        if (Number.isNaN(cantidad)) {
          processed++;
          errors.push({ codigo, error: 'Cantidad inválida' });
          if (processed === results.length) return res.json({ message: 'Stock actualizado', procesados: results.length - errors.length, errores: errors });
          return;
        }

        db.run(
          'UPDATE productos SET stock = ? WHERE codigo = ?',
          [cantidad, codigo],
          function (err) {
            processed++;
            if (err) errors.push({ codigo, error: err.message });
            if (processed === results.length) {
              crearBackup(usuario, 'Stock CSV', `Filas: ${results.length}, OK: ${results.length - errors.length}`);
              res.json({
                message: 'Stock actualizado',
                procesados: results.length - errors.length,
                errores: errors
              });
            }
          }
        );
      });
    })
    .on('error', (err) => {
      res.status(500).json({ error: err.message });
    });
});

// 7. OBTENER STOCK DE UN PRODUCTO
app.get('/api/productos/stock/:codigo', requireAuth, (req, res) => {
  const db = req.db;
  const { codigo } = req.params;

  db.get(
    'SELECT codigo, descripcion, stock FROM productos WHERE codigo = ?',
    [codigo],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Producto no encontrado' });
      res.json(row);
    }
  );
});

// 8. CUENTAS CORRIENTES - OBTENER
app.get('/api/cuentas', requireAuth, (req, res) => {
  const db = req.db;
  db.all('SELECT * FROM cuentasCorrientes ORDER BY cliente', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// 9. CUENTAS CORRIENTES - CREAR
app.post('/api/cuentas', requireAuth, (req, res) => {
  const db = req.db;
  const usuario = req.session.usuario;

  const { cliente } = req.body;

  if (!cliente) return res.status(400).json({ error: 'Nombre de cliente requerido' });

  db.run(
    'INSERT OR IGNORE INTO cuentasCorrientes (cliente, deuda, pagos) VALUES (?, 0, 0)',
    [cliente],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      crearBackup(usuario, 'Cuenta corriente creada', `Cliente: ${cliente}`);
      res.json({ message: 'Cuenta creada' });
    }
  );
});

// 11. AGREGAR MOVIMIENTO A CUENTA
app.post('/api/cuentas/:cliente/movimiento', requireAuth, (req, res) => {
  const db = req.db;
  const usuario = req.session.usuario;

  const { cliente } = req.params;
  const { tipo, monto, fecha, comentario } = req.body;

  if (!tipo || !monto || monto <= 0 || !fecha) {
    return res.status(400).json({ error: 'Tipo, monto y fecha requeridos' });
  }

  const campo = tipo === 'deuda' ? 'deuda' : 'pagos';

  db.run(
    'INSERT INTO movimientosCuentas (cliente, tipo, monto, fecha, comentario) VALUES (?, ?, ?, ?, ?)',
    [cliente, tipo, parseFloat(monto), fecha, comentario || ''],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      db.run(
        `UPDATE cuentasCorrientes SET ${campo} = ${campo} + ? WHERE cliente = ?`,
        [parseFloat(monto), cliente],
        function (err2) {
          if (err2) return res.status(500).json({ error: err2.message });
          if (this.changes === 0) return res.status(404).json({ error: 'Cliente no encontrado' });

          crearBackup(usuario, 'Movimiento CC', `${cliente}: ${tipo} $${monto}`);
          res.json({ ok: true });
        }
      );
    }
  );
});

// 12. OBTENER MOVIMIENTOS
app.get('/api/cuentas/:cliente/movimientos', requireAuth, (req, res) => {
  const db = req.db;
  const { cliente } = req.params;

  db.all(
    'SELECT * FROM movimientosCuentas WHERE cliente = ? ORDER BY fecha DESC, id DESC',
    [cliente],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
});

// 13. ELIMINAR CUENTA
app.delete('/api/cuentas/:cliente', requireAuth, (req, res) => {
  const db = req.db;
  const usuario = req.session.usuario;
  const { cliente } = req.params;

  db.run('DELETE FROM movimientosCuentas WHERE cliente = ?', [cliente], (err) => {
    if (err) return res.status(500).json({ error: 'Error al eliminar movimientos' });

    db.run('DELETE FROM cuentasCorrientes WHERE cliente = ?', [cliente], function (err2) {
      if (err2) return res.status(500).json({ error: 'Error al eliminar cuenta' });
      if (this.changes === 0) return res.status(404).json({ error: 'Cuenta no encontrada' });

      crearBackup(usuario, 'Cuenta corriente eliminada', `Cliente: ${cliente}`);
      res.json({ ok: true, message: 'Cuenta eliminada' });
    });
  });
});

// 14. HISTÓRICO DE VENTAS
app.get('/api/ventas/historico', requireAuth, (req, res) => {
  const db = req.db;
  const { anio, meses } = req.query;

  if (!anio || !meses) return res.status(400).json({ error: 'anio y meses son requeridos' });

  const mesesArray = meses.split(',').map(m => parseInt(m)).filter(m => m >= 1 && m <= 12);
  if (!mesesArray.length) return res.status(400).json({ error: 'meses inválidos' });

  const placeholders = mesesArray.map(() => '?').join(',');
  const params = [anio, ...mesesArray];

  const sql = `
    SELECT *
    FROM ventas
    WHERE strftime('%Y', fecha) = ?
      AND CAST(strftime('%m', fecha) AS INTEGER) IN (${placeholders})
    ORDER BY fecha DESC, id DESC
  `;

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// 15. IMPORTAR VENTAS DESDE CSV
app.post('/api/ventas/import-csv', requireAuth, upload.single('file'), (req, res) => {
  const db = req.db;
  const usuario = req.session.usuario;

  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });

  const contenido = req.file.buffer.toString('utf-8');
  const lineas = contenido.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  if (lineas.length < 2) return res.status(400).json({ error: 'El archivo está vacío o no tiene datos' });

  const filas = lineas.slice(1);
  let importadas = 0;
  let omitidas = 0;

  const insertStmt = db.prepare(`
    INSERT INTO ventas (fecha, codigoArticulo, cantidad, precio, descuento, categoria, factura, tipoPago, detalles, caja)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  filas.forEach((linea, index) => {
    const valores = [];
    let dentroComillas = false;
    let valorActual = '';

    for (let i = 0; i < linea.length; i++) {
      const char = linea[i];
      if (char === '"') {
        dentroComillas = !dentroComillas;
      } else if (char === ',' && !dentroComillas) {
        valores.push(valorActual.trim().replace(/^"|"$/g, ''));
        valorActual = '';
      } else {
        valorActual += char;
      }
    }
    valores.push(valorActual.trim().replace(/^"|"$/g, ''));

    if (valores.length < 7) { omitidas++; return; }

    let [fecha, codigoArticulo, cantidad, precio, categoria, factura, tipoPago] = valores;

    if (!fecha || !codigoArticulo || !cantidad || fecha.includes('#N/A')) { omitidas++; return; }

    const partesFecha = fecha.split('/');
    if (partesFecha.length !== 3) { omitidas++; return; }
    const [dia, mes, anio] = partesFecha;
    const fechaISO = `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;

    precio = precio.replace(/[\$\.]/g, '').replace(',', '.').trim();
    const precioTotal = parseFloat(precio);
    if (isNaN(precioTotal)) { omitidas++; return; }

    const cantidadNum = parseInt(cantidad);
    if (isNaN(cantidadNum) || cantidadNum === 0) { omitidas++; return; }

    const precioUnitario = precioTotal / cantidadNum;
    codigoArticulo = String(codigoArticulo).trim();

    try {
      insertStmt.run(
        fechaISO,
        codigoArticulo,
        cantidadNum,
        precioUnitario,
        0,
        categoria || '',
        factura || '',
        tipoPago || '',
        '',
        'Principal'
      );
      importadas++;
    } catch (err) {
      console.error(`Error insertando venta en fila ${index + 1}:`, err.message);
      omitidas++;
    }
  });

  insertStmt.finalize();
  crearBackup(usuario, 'Importación CSV', `${importadas} ventas importadas, ${omitidas} omitidas`);
  res.json({ importadas, omitidas });
});

// 16. OBTENER DESCRIPCIONES
app.get('/api/productos/descripciones', requireAuth, (req, res) => {
  const db = req.db;
  const codigos = req.query.codigos ? req.query.codigos.split(',') : [];

  if (!codigos.length) return res.json({});

  const placeholders = codigos.map(() => '?').join(',');
  const query = `SELECT codigo, descripcion FROM productos WHERE codigo IN (${placeholders})`;

  db.all(query, codigos, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const descripciones = {};
    (rows || []).forEach(row => { descripciones[row.codigo] = row.descripcion; });
    res.json(descripciones);
  });
});

// ==================== CAMBIOS ====================
app.post('/api/cambios', requireAuth, (req, res) => {
  const db = req.db;
  const usuario = req.session.usuario;

  const { fecha, articuloDevuelto, articuloNuevo, precioDevuelto, precioNuevo, diferencia, comentarios } = req.body;

  if (!fecha || !articuloDevuelto || !articuloNuevo) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  db.run(`
    INSERT INTO cambios (fecha, articuloDevuelto, articuloNuevo, precioDevuelto, precioNuevo, diferencia, comentarios)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [fecha, articuloDevuelto, articuloNuevo, precioDevuelto, precioNuevo, diferencia, comentarios || ''],
    function (err) {
      if (err) return res.status(500).json({ error: 'Error al registrar cambio' });
      crearBackup(usuario, 'Cambio registrado', `${articuloDevuelto} → ${articuloNuevo}, Dif: $${diferencia}`);
      res.json({ ok: true, id: this.lastID });
    }
  );
});

app.get('/api/cambios', requireAuth, (req, res) => {
  const db = req.db;
  db.all('SELECT * FROM cambios ORDER BY fecha DESC, id DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error al obtener cambios' });
    res.json(rows || []);
  });
});

app.get('/api/cambios/reporte', requireAuth, (req, res) => {
  const db = req.db;
  const { desde, hasta } = req.query;

  let query = 'SELECT * FROM cambios';
  const params = [];

  if (desde && hasta) { query += ' WHERE fecha >= ? AND fecha <= ?'; params.push(desde, hasta); }
  else if (desde) { query += ' WHERE fecha >= ?'; params.push(desde); }
  else if (hasta) { query += ' WHERE fecha <= ?'; params.push(hasta); }

  query += ' ORDER BY fecha DESC';

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const cambios = rows || [];
    const stats = {
      totalCambios: cambios.length,
      diferenciaPositiva: cambios.filter(c => c.diferencia > 0).reduce((sum, c) => sum + c.diferencia, 0),
      diferenciaNegativa: cambios.filter(c => c.diferencia < 0).reduce((sum, c) => sum + Math.abs(c.diferencia), 0),
      cambiosSinDiferencia: cambios.filter(c => c.diferencia === 0).length
    };

    res.json({ cambios, stats });
  });
});

app.delete('/api/cambios/:id', requireAuth, (req, res) => {
  const db = req.db;
  const usuario = req.session.usuario;
  const { id } = req.params;

  db.run('DELETE FROM cambios WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: 'Error al eliminar cambio' });
    if (this.changes === 0) return res.status(404).json({ error: 'Cambio no encontrado' });

    crearBackup(usuario, 'Cambio eliminado', `ID: ${id}`);
    res.json({ ok: true, eliminado: id });
  });
});

// ==================== CONFIGURACIÓN ====================
app.get('/api/config', requireAuth, (req, res) => {
  const config = cargarConfig();
  res.json(config);
});

app.post('/api/config/nombre', requireAuth, (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });

  const config = cargarConfig();
  config.appName = nombre;

  if (guardarConfig(config)) res.json({ ok: true, nombre });
  else res.status(500).json({ error: 'Error al guardar' });
});

// ==================== BACKUPS ====================
app.get('/api/backups', requireAuth, (req, res) => {
  const usuario = req.session.usuario;
  const dirUser = dirBackupsUsuario(usuario);
  const metadataFile = path.join(dirUser, 'metadata.json');

  try {
    if (fs.existsSync(metadataFile)) {
      const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
      return res.json(metadata);
    }
    return res.json([]);
  } catch (error) {
    console.error('Error leyendo backups:', error);
    res.status(500).json({ error: 'Error al leer backups' });
  }
});

app.post('/api/backups/restaurar', requireAuth, (req, res) => {
  const usuario = req.session.usuario;
  const { archivo } = req.body || {};

  if (!archivo) return res.status(400).json({ error: 'Archivo requerido' });

  const dirUser = dirBackupsUsuario(usuario);
  const rutaBackup = path.join(dirUser, archivo);

  if (!fs.existsSync(rutaBackup)) return res.status(404).json({ error: 'Backup no encontrado' });

  try {
    // Backup del estado actual
    crearBackup(usuario, 'Pre-restauración', `Antes de restaurar a: ${archivo}`);

    const rutaPendiente = path.join(DATOS_DIR, `${usuario}.restore_pending.db`);
    fs.copyFileSync(rutaBackup, rutaPendiente);

    res.json({
      ok: true,
      mensaje: 'Backup preparado. Reiniciá el servidor para completar la restauración.',
      requiereReinicio: true
    });
  } catch (error) {
    console.error('Error preparando restauración:', error);
    res.status(500).json({ error: 'Error al preparar restauración' });
  }
});

// ==================== SERVIDOR ====================
const PORT = process.env.PORT || 3000;

// Al iniciar, aplicar restauraciones pendientes por usuario
try {
  const files = fs.readdirSync(DATOS_DIR);
  files
    .filter(f => f.endsWith('.restore_pending.db'))
    .forEach(f => {
      const usuario = f.replace('.restore_pending.db', '');
      const src = path.join(DATOS_DIR, f);
      const dest = path.join(DATOS_DIR, `${usuario}.db`);
      fs.copyFileSync(src, dest);
      fs.unlinkSync(src);
      console.log(`✅ BD restaurada para usuario: ${usuario}`);
      // Si estaba cacheada, cerrar y reabrir
      if (conexionesDb[usuario]) {
        try { conexionesDb[usuario].close(); } catch (_) {}
        delete conexionesDb[usuario];
      }
    });
} catch (e) {
  console.error('Error aplicando restauraciones pendientes:', e);
}

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log('📌 Usuario por defecto: admin');
  console.log('📌 Contraseña por defecto: admin123');
});
