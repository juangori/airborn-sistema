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

// ==================== PROMESAS SQL (Helpers) ====================
// Estas funciones nos permiten usar await con sqlite3
const dbRun = (db, sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbGet = (db, sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// ==================== CONFIGURACIÓN ====================
const DATOS_DIR = './datos';          // acá se guardan las BD por cliente: datos/<usuario>.db
// Guardar backups DENTRO de la carpeta segura para que no se borren al reiniciar
const BACKUPS_DIR = path.join(DATOS_DIR, 'backups');
const USUARIOS_DB = path.join(DATOS_DIR, 'usuarios.db');
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
const isProduction = process.env.NODE_ENV === 'production';

app.use(session({
  secret: process.env.SESSION_SECRET || 'secreto_super_seguro_cambiar',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, // ¡Ahora sí! Forzamos cookies seguras
    httpOnly: true,
    sameSite: 'lax', // Recomendado para cookies modernas
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Importante: Para que las cookies seguras funcionen en Railway (que usa proxy)
app.set('trust proxy', 1);

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

    // --- NUEVA TABLA PARA MOVIMIENTOS DE CAJA ---
    db.run(`CREATE TABLE IF NOT EXISTS movimientosCaja (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT,
        tipo TEXT, -- 'ingreso' o 'egreso'
        monto REAL,
        detalle TEXT
    )`);

    db.run(`
      CREATE TABLE IF NOT EXISTS cuentasCorrientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente TEXT UNIQUE,
        telefono TEXT,
        articulo TEXT,
        deuda REAL DEFAULT 0,
        pagos REAL DEFAULT 0
      )
    `);

    // Migración automática para bases existentes (intenta agregar columnas, ignora si ya están)
    const columnasExtra = ['telefono TEXT', 'articulo TEXT'];
    columnasExtra.forEach(col => {
      db.run(`ALTER TABLE cuentasCorrientes ADD COLUMN ${col}`, (err) => {
        // Ignoramos error si la columna ya existe
      });
    });

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

    db.run(`
      CREATE TABLE IF NOT EXISTS cajasIniciales (
        fecha DATE PRIMARY KEY,
        monto REAL DEFAULT 0
      )
    `);

    // === AGREGAR ESTO AQUÍ ADENTRO ===
    db.run(`
      CREATE TABLE IF NOT EXISTS movimientosCaja (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT,
        tipo TEXT, 
        monto REAL,
        detalle TEXT
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
  const { codigo, q } = req.query;
  const busqueda = q || codigo || '';

  if (!busqueda || busqueda.length < 2) {
    return res.status(400).json({ error: 'Búsqueda muy corta' });
  }

  // Buscar por código O descripción
  db.all(
    `SELECT * FROM productos 
     WHERE codigo LIKE ? OR descripcion LIKE ? 
     ORDER BY 
       CASE WHEN codigo LIKE ? THEN 0 ELSE 1 END,
       descripcion
     LIMIT 20`,
    [`%${busqueda}%`, `%${busqueda}%`, `${busqueda}%`],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }
      // Si buscan por código exacto o hay un solo resultado, devolver objeto
      // Si hay múltiples, devolver array
      if (rows.length === 1) {
        res.json(rows[0]);
      } else {
        res.json({ multiple: true, productos: rows });
      }
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

// 3. REGISTRAR VENTA (CON TRANSACCIÓN)
app.post('/api/ventas', requireAuth, async (req, res) => {
  const db = req.db;
  const usuario = req.session.usuario;

  const {
    fecha, articulo, cantidad, precio, descuento = 0,
    categoria, factura, tipoPago, comentarios
  } = req.body;

  // Validamos que existan los campos, pero permitimos precio 0 y cantidad negativa
  if (!fecha || !articulo || cantidad === undefined || precio === undefined) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  try {
    // 1. Arrancamos la transacción (Todo o nada)
    await dbRun(db, "BEGIN TRANSACTION");

    // 2. Insertamos la venta
    await dbRun(db, `
      INSERT INTO ventas
      (fecha, codigoArticulo, cantidad, precio, descuento, categoria, factura, tipoPago, detalles, caja)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      fecha, articulo, cantidad, precio, descuento,
      categoria || '', factura || 'A', tipoPago || '',
      comentarios || '', 'A'
    ]);

    // 3. Descontamos stock
    await dbRun(db, 'UPDATE productos SET stock = stock - ? WHERE codigo = ?', [cantidad, articulo]);

    // 4. Si todo salió bien, guardamos cambios permanentemente
    await dbRun(db, "COMMIT");

    crearBackup(usuario, 'Venta registrada', `Art: ${articulo}, Cant: ${cantidad}, $${precio}`);
    res.json({ ok: true, mensaje: 'Venta registrada y stock actualizado' });

  } catch (error) {
    // 5. Si algo falló, deshacemos TODO (como si nunca hubiera pasado)
    console.error("Error en transacción venta:", error);
    await dbRun(db, "ROLLBACK");
    res.status(500).json({ error: 'Error registrando venta: ' + error.message });
  }
});

// 4. OBTENER VENTAS (CON DESCRIPCIÓN DE PRODUCTO)
app.get('/api/ventas', requireAuth, (req, res) => {
  const db = req.db;
  
  // JOIN con productos para traer la descripción
  const sql = `
    SELECT v.*, p.descripcion as descripcionProducto, p.categoria as categoriaProducto
    FROM ventas v
    LEFT JOIN productos p ON LOWER(TRIM(v.codigoArticulo)) = LOWER(TRIM(p.codigo))
    ORDER BY v.id DESC 
    LIMIT 500
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error leyendo ventas:', err);
      return res.status(500).json({ error: 'Error al leer ventas' });
    }

    const ventas = (rows || []).map(r => ({
      id: r.id,
      fecha: r.fecha,
      articulo: r.codigoArticulo,
      descripcion: r.descripcionProducto || r.detalles || '',
      cantidad: r.cantidad,
      precio: r.precio,
      descuento: r.descuento || 0,
      categoria: r.categoriaProducto || r.categoria || '',
      factura: r.factura || '',
      tipoPago: r.tipoPago || '',
      comentarios: r.detalles || ''
    }));

    res.json(ventas);
  });
});

// 4b. ELIMINAR VENTA (CON TRANSACCIÓN)
app.delete('/api/ventas/:id', requireAuth, async (req, res) => {
  const db = req.db;
  const usuario = req.session.usuario;
  const { id } = req.params;

  try {
    await dbRun(db, "BEGIN TRANSACTION");

    // 1. Buscar datos de la venta para saber cuánto stock devolver
    const venta = await dbGet(db, 'SELECT codigoArticulo, cantidad, precio FROM ventas WHERE id = ?', [id]);
    
    if (!venta) {
      await dbRun(db, "ROLLBACK"); // Cancelamos por las dudas
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    // 2. Eliminar la venta
    await dbRun(db, 'DELETE FROM ventas WHERE id = ?', [id]);

    // 3. Devolver el stock
    await dbRun(db, 'UPDATE productos SET stock = stock + ? WHERE codigo = ?', [venta.cantidad, venta.codigoArticulo]);

    await dbRun(db, "COMMIT");

    crearBackup(usuario, 'Venta eliminada', `Art: ${venta.codigoArticulo}, Cant: ${venta.cantidad}, $${venta.precio}`);
    res.json({ ok: true, mensaje: `Venta eliminada y ${venta.cantidad} unidades devueltas al stock` });

  } catch (error) {
    console.error("Error eliminando venta:", error);
    await dbRun(db, "ROLLBACK");
    res.status(500).json({ error: 'Error al eliminar la venta' });
  }
});

// 5. ACTUALIZAR PRODUCTO
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
  const modo = req.body.modo || 'replace'; // 'replace' (corregir) o 'add' (sumar)

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const results = [];
  const stream = Readable.from(req.file.buffer.toString('utf8'));

  stream
    .pipe(csv())
    .on('data', (row) => results.push(row))
    .on('end', () => {
      if (!results.length) return res.json({ message: 'Archivo vacío', procesados: 0, errores: [] });

      let processed = 0;
      const errors = [];

      // Definir la consulta SQL según el modo elegido
      const sqlQuery = modo === 'add' 
        ? 'UPDATE productos SET stock = stock + ? WHERE codigo = ?'  // Suma
        : 'UPDATE productos SET stock = ? WHERE codigo = ?';         // Reemplaza

      results.forEach((row) => {
        // Normalizar nombres de columnas
        const codigo = (row.codigo || row.CODIGO || row.Codigo || row['Código'] || row['CODIGO'] || '').toString().trim();
        const cantidadRaw = row.cantidad ?? row.stock ?? row.Stock ?? row.CANTIDAD ?? row['Cantidad'] ?? row['STOCK'];

        if (!codigo) {
          processed++;
          if (processed === results.length) finalizar();
          return;
        }

        const cantidad = parseInt((cantidadRaw ?? '0').toString().replace(/[^\d-]/g, ''), 10);
        
        if (Number.isNaN(cantidad)) {
          processed++;
          errors.push({ codigo, error: 'Cantidad inválida' });
          if (processed === results.length) finalizar();
          return;
        }

        db.run(sqlQuery, [cantidad, codigo], function (err) {
            processed++;
            if (err) errors.push({ codigo, error: err.message });
            
            // Si el producto no existía (no actualizó nada), podrías reportarlo como error u omitirlo
            if (this.changes === 0) errors.push({ codigo, error: 'Producto no encontrado' });

            if (processed === results.length) finalizar();
        });
      });

      function finalizar() {
        const accionTexto = modo === 'add' ? 'Stock sumado por CSV' : 'Stock corregido por CSV';
        crearBackup(usuario, accionTexto, `Filas: ${results.length}, OK: ${results.length - errors.length}`);
        
        res.json({
          message: 'Proceso finalizado',
          procesados: results.length - errors.length,
          errores: errors
        });
      }
    })
    .on('error', (err) => {
      res.status(500).json({ error: err.message });
    });
});

// 6b. IMPORTAR PRODUCTOS CSV (MEJORADO Y BLINDADO)
app.post('/api/productos/importar', requireAuth, upload.single('file'), async (req, res) => {
  const db = req.db;
  const usuario = req.session.usuario;

  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });

  // Función auxiliar para promesas
  const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  };

  let importados = 0;
  let actualizados = 0;
  const errores = [];

  try {
    await dbRun("BEGIN TRANSACTION");

    // 1. Limpieza de BOM
    let csvContent = req.file.buffer.toString('utf8');
    if (csvContent.charCodeAt(0) === 0xFEFF) {
        csvContent = csvContent.slice(1);
    }

    const stream = Readable.from(csvContent)
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim().toLowerCase(),
        separator: ',' 
      }));

    for await (const row of stream) {
      // 2. Mapeo inteligente de columnas (acepta varios nombres comunes)
      const codigo = row.codigo || row['código'] || row.id;
      const descripcion = row.descripcion || row['descripción'] || row.producto || row.nombre || '';
      const categoria = row.categoria || row['categoría'] || row.rubro || 'General';
      
      const precioRaw = row.preciopublico || row.precio || row['precio público'] || '0';
      const costoRaw = row.costo || '0';
      const stockRaw = row.stock || row.cantidad || row.existencia || '0';

      // Validación mínima
      if (!codigo) continue;

      // 3. Limpieza de datos (Precios ARS y Stock)
      // Usamos parseARS para que entienda "$ 43.990,00"
      const precioNum = parseARS(precioRaw);
      const costoNum = parseARS(costoRaw);
      const stockNum = parseInt(stockRaw.toString().replace(/[.,]/g, '')) || 0;

      // 4. Insertar o Actualizar (Upsert)
      try {
        await dbRun(`
          INSERT INTO productos (codigo, descripcion, categoria, precioPublico, costo, stock)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(codigo) DO UPDATE SET
            descripcion = excluded.descripcion,
            categoria = excluded.categoria,
            precioPublico = excluded.precioPublico,
            costo = excluded.costo,
            stock = excluded.stock
        `, [
          codigo.toString().trim(),
          descripcion.toString().trim(), // Aseguramos que entre la descripción
          categoria.toString().trim(),
          precioNum,
          costoNum,
          stockNum
        ]);
        importados++;
      } catch (err) {
        errores.push(`Error en código ${codigo}: ${err.message}`);
      }
    }

    await dbRun("COMMIT");

    crearBackup(usuario, 'Importación Productos', `Procesados: ${importados}`);
    res.json({ 
        ok: true, 
        importados, 
        mensaje: `Se procesaron ${importados} productos correctamente.`,
        errores: errores.length > 0 ? errores : undefined
    });

  } catch (error) {
    console.error("Error importando productos:", error);
    try { await dbRun("ROLLBACK"); } catch (_) {}
    res.status(500).json({ error: 'Error procesando archivo: ' + error.message });
  }
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
  
  // IMPORTANTE: Asegurate que diga "SELECT *" o que incluya telefono y articulo
  const sql = "SELECT * FROM cuentasCorrientes ORDER BY cliente ASC";
  
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 9. CUENTAS CORRIENTES - CREAR (ACTUALIZADO)
app.post('/api/cuentas', requireAuth, (req, res) => {
  const db = req.db;
  const usuario = req.session.usuario;
  const { cliente, telefono, articulo } = req.body;

  if (!cliente) return res.status(400).json({ error: 'Nombre requerido' });

  // Insertar o Ignorar (si ya existe no hace nada)
  db.run(
    'INSERT OR IGNORE INTO cuentasCorrientes (cliente, telefono, articulo, deuda, pagos) VALUES (?, ?, ?, 0, 0)',
    [cliente.trim(), telefono || '', articulo || ''],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // Si ya existía (no insertó), actualizamos los datos extra por si cambiaron
      if (this.changes === 0) {
        db.run('UPDATE cuentasCorrientes SET telefono = ?, articulo = ? WHERE cliente = ?', 
          [telefono || '', articulo || '', cliente.trim()]);
      }

      crearBackup(usuario, 'Cuenta Creada/Act', `Cliente: ${cliente}`);
      res.json({ message: 'Cuenta gestionada' });
    }
  );
});

// 11. AGREGAR MOVIMIENTO A CUENTA (CON TRANSACCIÓN)
app.post('/api/cuentas/:cliente/movimiento', requireAuth, async (req, res) => {
  const db = req.db;
  const usuario = req.session.usuario;
  const { cliente } = req.params;
  const { tipo, monto, fecha, comentario } = req.body;

  if (!tipo || !monto || monto <= 0 || !fecha) {
    return res.status(400).json({ error: 'Tipo, monto y fecha requeridos' });
  }

  const campo = tipo === 'deuda' ? 'deuda' : 'pagos';

  try {
    await dbRun(db, "BEGIN TRANSACTION");

    // 1. Registrar el movimiento en el historial
    await dbRun(db, 
      'INSERT INTO movimientosCuentas (cliente, tipo, monto, fecha, comentario) VALUES (?, ?, ?, ?, ?)',
      [cliente, tipo, parseFloat(monto), fecha, comentario || '']
    );

    // 2. Actualizar el saldo total del cliente
    // OJO: Usamos `this.changes` verificando el resultado de la promesa si quisieramos validar cliente, 
    // pero con dbRun simple confiamos en el update.
    await dbRun(db, 
      `UPDATE cuentasCorrientes SET ${campo} = ${campo} + ? WHERE cliente = ?`,
      [parseFloat(monto), cliente]
    );

    await dbRun(db, "COMMIT");

    crearBackup(usuario, 'Movimiento CC', `${cliente}: ${tipo} $${monto}`);
    res.json({ ok: true });

  } catch (error) {
    console.error("Error movimiento CC:", error);
    await dbRun(db, "ROLLBACK");
    res.status(500).json({ error: 'Error registrando movimiento' });
  }
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

// ==================== PROMEDIOS MENSUALES (MODIFICADO PARA PRENDAS) ====================
app.get('/api/ventas/promedios', requireAuth, (req, res) => {
  const db = req.db;
  const { anio, mes } = req.query;

  if (!anio || !mes) return res.status(400).json({ error: 'Año y mes requeridos' });

  const mesStr = mes.toString().padStart(2, '0');
  const periodo = `${anio}-${mesStr}`;

  // AGREGAMOS: SUM(cantidad) as cantidadDia
  const sql = `
    SELECT 
      fecha,
      SUM(precio * cantidad * (1 - COALESCE(descuento, 0) / 100.0)) as totalDia,
      SUM(cantidad) as cantidadDia,
      COUNT(*) as tickets
    FROM ventas
    WHERE strftime('%Y-%m', fecha) = ?
    GROUP BY fecha
    ORDER BY fecha ASC
  `;

  db.all(sql, [periodo], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // CAMBIO IMPORTANTE: Ahora el mapa guarda un OBJETO con dinero y cantidad
    const mapaDatos = {};
    rows.forEach(r => {
        mapaDatos[r.fecha] = {
            dinero: r.totalDia,
            prendas: r.cantidadDia
        };
    });

    res.json({ ok: true, ventas: mapaDatos });
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

  // JOIN con productos para traer la descripción
  const sql = `
    SELECT v.*, p.descripcion
    FROM ventas v
    LEFT JOIN productos p ON v.codigoArticulo = p.codigo
    WHERE strftime('%Y', v.fecha) = ?
      AND CAST(strftime('%m', v.fecha) AS INTEGER) IN (${placeholders})
    ORDER BY v.fecha DESC, v.id DESC
  `;

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// =======================================================
// 15. IMPORTAR VENTAS DESDE CSV (CORREGIDO Y BLINDADO)
// =======================================================
app.post('/api/ventas/import-csv', requireAuth, upload.single('file'), async (req, res) => {
  const db = req.db;
  const usuario = req.session.usuario;

  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });

  // Función auxiliar para promesas
  const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  };

  // --- FUNCIÓN DE NORMALIZACIÓN DE FECHA ---
  const normalizarFecha = (fechaStr) => {
      if (!fechaStr) return null;
      fechaStr = fechaStr.trim();
      // Si ya viene como YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) return fechaStr;
      // Detectar separador (/ o -)
      const partes = fechaStr.split(/[\/\-]/); 
      if (partes.length === 3) {
          let dia = partes[0].padStart(2, '0');
          let mes = partes[1].padStart(2, '0');
          let anio = partes[2];
          if (anio.length === 2) anio = '20' + anio;
          return `${anio}-${mes}-${dia}`;
      }
      return null; 
  };

  const errores = [];
  let importadas = 0;
  let procesadas = 0;

  try {
    await dbRun("BEGIN TRANSACTION");

    // 1. LIMPIEZA DE BOM (Byte Order Mark) y espacios iniciales
    // Esto arregla el error de que la columna "Fecha" no se reconozca
    let csvContent = req.file.buffer.toString('utf8');
    if (csvContent.charCodeAt(0) === 0xFEFF) {
        csvContent = csvContent.slice(1);
    }

    const stream = Readable.from(csvContent)
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim().toLowerCase(),
        separator: ',' // IMPORTANTE: Confirmá si tu CSV usa coma (,) o punto y coma (;)
      }));

    for await (const row of stream) {
      procesadas++;

      // 2. Mapeo inteligente de columnas
      const fechaRaw = row.fecha || row.date || row.FECHA;
      const articulo = row.articulo || row.codigo || row.article || row.ARTICULO;
      const cantidadRaw = row.cantidad || row.cant || row.qty;
      const precioRaw = row.precio || row.price || row.monto || row.total;
      
      const categoria = row.categoria || row.category || '';
      const factura = row.factura || row.invoice || '';
      const tipoPago = row['tipo pago'] || row.tipopago || row.pago || 'Efectivo';
      const comentarios = row.comentarios || row.detalle || 'Importado CSV';

      // Validación básica
      if (!fechaRaw || !articulo) {
        // Solo reportar error si la fila no está totalmente vacía
        if (Object.values(row).some(x => x)) {
            errores.push(`Fila ${procesadas}: Falta fecha o artículo`);
        }
        continue;
      }

      // 3. Normalizar Fecha
      const fechaISO = normalizarFecha(fechaRaw);
      if (!fechaISO) {
          errores.push(`Fila ${procesadas}: Fecha inválida (${fechaRaw})`);
          continue;
      }

      // 4. Parseo de Precio ARGENTINO (Usamos tu función parseARS)
      // Esto maneja perfecto el "$ 64.990,00" quitando el punto de mil y la coma
      const precioFinal = parseARS(precioRaw);

      // 5. Parseo de Cantidad
      const cleanCantidad = cantidadRaw ? cantidadRaw.toString().replace(/[.,]/g, '') : '1';
      const cantidad = parseInt(cleanCantidad);

      if (isNaN(precioFinal) || isNaN(cantidad) || cantidad === 0) {
         errores.push(`Fila ${procesadas}: Error en precio ($${precioRaw}) o cantidad (${cantidadRaw})`);
         continue; 
      }

      // 6. Insertar en BD
      try {
        await dbRun(`
          INSERT INTO ventas (fecha, codigoArticulo, cantidad, precio, descuento, categoria, factura, tipoPago, detalles, caja)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          fechaISO,
          articulo.trim(),
          cantidad,
          precioFinal,
          0,
          categoria.trim(),
          factura.trim(),
          tipoPago.trim(),
          comentarios,
          'A' // Asumimos Caja A por defecto
        ]);
        importadas++;
      } catch (err) {
        errores.push(`Fila ${procesadas}: Error BD - ${err.message}`);
      }
    }

    await dbRun("COMMIT");
    
    crearBackup(usuario, 'Importación CSV', `Importadas: ${importadas}`);
    
    res.json({
      ok: true,
      totalProcesadas: procesadas,
      importadas: importadas,
      errores: errores.slice(0, 50)
    });

  } catch (errorGeneral) {
    console.error("Error fatal importando:", errorGeneral);
    try { await dbRun("ROLLBACK"); } catch (_) {}
    res.status(500).json({ error: 'Error procesando archivo: ' + errorGeneral.message });
  }
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

// =======================================================
// 17. COMPARATIVA ANUAL (NUEVO)
// =======================================================
app.get('/api/ventas/comparativa', requireAuth, async (req, res) => {
  const db = req.db;
  const { anio1, anio2 } = req.query;

  if (!anio1 || !anio2) {
    return res.status(400).json({ error: 'Se requieren dos años para comparar (anio1 y anio2)' });
  }

  try {
    // Función interna para obtener datos de un año agrupados por mes
    const obtenerDatosAnio = async (anio) => {
      // OJO: SQLite strftime %m devuelve '01', '02', etc.
      const sql = `
        SELECT 
          strftime('%m', fecha) as mes,
          SUM(precio * cantidad) as facturacion,
          SUM(cantidad) as unidades,
          COUNT(*) as tickets
        FROM ventas 
        WHERE strftime('%Y', fecha) = ?
        GROUP BY mes
        ORDER BY mes ASC
      `;
      return await dbAll(db, sql, [anio]);
    };

    // Helper para db.all con promesa (si no lo tenías agregado arriba, agregalo junto con dbRun)
    const dbAll = (database, query, params) => {
      return new Promise((resolve, reject) => {
        database.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    };

    // Ejecutamos las dos consultas en paralelo
    const [datosAnio1, datosAnio2] = await Promise.all([
      obtenerDatosAnio(anio1),
      obtenerDatosAnio(anio2)
    ]);

    // Estructuramos la respuesta para que sea fácil de usar en gráficos
    // Creamos un array del 1 al 12 para asegurar que estén todos los meses, aunque no haya ventas
    const reporte = Array.from({ length: 12 }, (_, i) => {
      const mesStr = (i + 1).toString().padStart(2, '0'); // '01', '02'...
      
      const dato1 = datosAnio1.find(d => d.mes === mesStr) || { facturacion: 0, unidades: 0, tickets: 0 };
      const dato2 = datosAnio2.find(d => d.mes === mesStr) || { facturacion: 0, unidades: 0, tickets: 0 };

      // Calcular variación porcentual (Cuidado con división por cero)
      const variacionFacturacion = dato1.facturacion === 0 ? 100 : ((dato2.facturacion - dato1.facturacion) / dato1.facturacion) * 100;
      const variacionUnidades = dato1.unidades === 0 ? 100 : ((dato2.unidades - dato1.unidades) / dato1.unidades) * 100;

      return {
        mes: mesStr,
        nombreMes: new Date(2000, i, 1).toLocaleString('es-AR', { month: 'long' }), // Enero, Febrero...
        anio1: {
          anio: anio1,
          ...dato1
        },
        anio2: {
          anio: anio2,
          ...dato2
        },
        variacion: {
          facturacion: parseFloat(variacionFacturacion.toFixed(1)),
          unidades: parseFloat(variacionUnidades.toFixed(1))
        }
      };
    });

    // Totales anuales
    const totalizar = (datos) => datos.reduce((acc, curr) => ({
      facturacion: acc.facturacion + (curr.facturacion || 0),
      unidades: acc.unidades + (curr.unidades || 0),
      tickets: acc.tickets + (curr.tickets || 0)
    }), { facturacion: 0, unidades: 0, tickets: 0 });

    res.json({
      ok: true,
      comparativa: reporte,
      totales: {
        [anio1]: totalizar(datosAnio1),
        [anio2]: totalizar(datosAnio2)
      }
    });

  } catch (error) {
    console.error("Error en comparativa:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== PRODUCTOS Y STOCK INDIVIDUAL ====================

// 1. CREAR PRODUCTO NUEVO (INDIVIDUAL)
app.post('/api/productos/nuevo', requireAuth, async (req, res) => {
    const db = req.db;
    const { codigo, descripcion, categoria, precio, costo, stock } = req.body;

    if (!codigo || !descripcion) {
        return res.status(400).json({ error: 'Código y Descripción son obligatorios' });
    }

    try {
        await dbRun(db, 
            `INSERT INTO productos (codigo, descripcion, categoria, precioPublico, costo, stock) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [codigo, descripcion, categoria || 'General', precio || 0, costo || 0, stock || 0]
        );
        
        crearBackup(req.session.usuario, 'Producto Creado', `Alta: ${codigo} (${descripcion})`);
        res.json({ ok: true, mensaje: 'Producto creado exitosamente' });
    } catch (e) {
        // Error común: Código duplicado (SQLITE_CONSTRAINT)
        if (e.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'El código ya existe' });
        }
        res.status(500).json({ error: e.message });
    }
});

// 2. ACTUALIZAR STOCK INDIVIDUAL (EDICIÓN RÁPIDA EN TABLA)
app.put('/api/productos/stock/unitario', requireAuth, async (req, res) => {
    const db = req.db;
    const { codigo, nuevoStock } = req.body;

    try {
        await dbRun(db, "UPDATE productos SET stock = ? WHERE codigo = ?", [nuevoStock, codigo]);
        // Opcional: No generamos backup por cada click para no saturar, o sí, depende tu gusto.
        // crearBackup(req.session.usuario, 'Ajuste Stock', `${codigo} -> ${nuevoStock}`);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// BORRAR PRODUCTO EN LA TABLA
app.delete('/api/productos/:codigo', requireAuth, async (req, res) => {
    const db = req.db;
    const { codigo } = req.params;
    try {
        await dbRun(db, "DELETE FROM productos WHERE codigo = ?", [codigo]);
        crearBackup(req.session.usuario, 'Producto Eliminado', `Código: ${codigo}`);
        res.json({ ok: true, mensaje: 'Producto eliminado' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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

// ==================== CONFIGURACIÓN (CORREGIDO MULTI-USER) ====================

// Obtener nombre del comercio (desde la sesión del usuario actual)
app.get('/api/config', requireAuth, (req, res) => {
  // Devolvemos el nombre que está guardado en la sesión (o un default)
  res.json({ 
      appName: req.session.nombreComercio || 'Mi Comercio' 
  });
});

// Cambiar nombre del comercio (Actualiza la DB de usuarios)
app.post('/api/config/nombre', requireAuth, (req, res) => {
  const { nombre } = req.body;
  const usuario = req.session.usuario;

  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });

  // 1. Actualizamos en la Tabla Maestra de Usuarios
  usuariosDb.run(
      'UPDATE usuarios SET nombreComercio = ? WHERE usuario = ?',
      [nombre, usuario],
      function(err) {
          if (err) return res.status(500).json({ error: err.message });
          
          // 2. Actualizamos la sesión activa para que se vea el cambio ya mismo
          req.session.nombreComercio = nombre;
          req.session.save(err => {
              res.json({ ok: true, nombre });
          });
      }
  );
});

// ==================== BACKUPS POR USER ====================
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

// ==================== SUPER ADMIN (GESTIÓN DE CLIENTES) ====================

// Middleware de seguridad: Solo deja pasar si sos 'admin'
function requireSuperAdmin(req, res, next) {
    if (req.session && req.session.usuario === 'admin') {
        return next();
    }
    return res.status(403).json({ error: 'Acceso denegado. Solo Admin.' });
}

// 1. LISTAR TODOS LOS CLIENTES
app.get('/api/admin/usuarios', requireAuth, requireSuperAdmin, (req, res) => {
    usuariosDb.all('SELECT id, usuario, nombreComercio, fechaCreacion FROM usuarios', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2. CREAR NUEVO CLIENTE (SAAS)
app.post('/api/admin/crear-usuario', requireAuth, requireSuperAdmin, (req, res) => {
    const { usuario, password, nombreComercio } = req.body;
    
    if (!usuario || !password) {
        return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    const hash = bcrypt.hashSync(password, 10);
    
    usuariosDb.run(
        `INSERT INTO usuarios (usuario, password, nombreComercio) VALUES (?, ?, ?)`,
        [usuario.trim(), hash, nombreComercio || ''],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'El usuario ya existe' });
                return res.status(500).json({ error: err.message });
            }
            res.json({ ok: true, mensaje: 'Usuario creado exitosamente' });
        }
    );
});

// ==================== SERVIDOR ====================
// ==================== CAJA INICIAL DEL DÍA ====================

// Asegurar que la tabla existe
function asegurarTablaCajasIniciales(db, callback) {
  db.run(`
    CREATE TABLE IF NOT EXISTS cajasIniciales (
      fecha DATE PRIMARY KEY,
      monto REAL DEFAULT 0
    )
  `, callback);
}

// Obtener caja inicial de un día
app.get('/api/caja-inicial/:fecha', requireAuth, (req, res) => {
  const db = req.db;
  const { fecha } = req.params;

  asegurarTablaCajasIniciales(db, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.get('SELECT monto FROM cajasIniciales WHERE fecha = ?', [fecha], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ fecha, monto: row ? row.monto : 0 });
    });
  });
});

// Guardar/actualizar caja inicial de un día
app.post('/api/caja-inicial', requireAuth, (req, res) => {
  const db = req.db;
  const { fecha, monto } = req.body;

  console.log('POST caja-inicial - fecha:', fecha, 'monto:', monto);

  if (!fecha) return res.status(400).json({ error: 'Fecha requerida' });

  asegurarTablaCajasIniciales(db, (err) => {
    if (err) {
      console.log('Error creando tabla:', err);
      return res.status(500).json({ error: err.message });
    }
    
    db.run(`
      INSERT OR REPLACE INTO cajasIniciales (fecha, monto) VALUES (?, ?)
    `, [fecha, monto || 0], function(err) {
      if (err) {
        console.log('Error insertando:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log('Guardado OK - changes:', this.changes);
      res.json({ ok: true, fecha, monto });
    });
  });
});

// ==================== ADMINISTRACIÓN DE DATOS ====================

// Limpiar ventas de un mes específico
app.post('/api/ventas/limpiar-mes', requireAuth, (req, res) => {
  const db = req.db;
  const usuario = req.session.usuario;
  const { mes, anio } = req.body;

  console.log('Limpiar ventas - mes:', mes, 'anio:', anio);

  if (!mes || !anio) {
    return res.status(400).json({ error: 'Mes y año requeridos' });
  }

  const mesStr = mes.toString().padStart(2, '0');
  const inicioMes = `${anio}-${mesStr}-01`;
  const finMes = `${anio}-${mesStr}-31`;

  console.log('Buscando ventas entre:', inicioMes, 'y', finMes);

  db.run(
    `DELETE FROM ventas WHERE fecha >= ? AND fecha <= ?`,
    [inicioMes, finMes],
    function(err) {
      if (err) {
        console.error('Error limpiando ventas:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log('Ventas eliminadas:', this.changes);
      crearBackup(usuario, 'Limpieza ventas', `${this.changes} ventas eliminadas (${mesStr}/${anio})`);
      res.json({ ok: true, eliminadas: this.changes });
    }
  );
});

// Limpiar tabla completa
app.post('/api/admin/limpiar/:tabla', requireAuth, (req, res) => {
  const db = req.db;
  const usuario = req.session.usuario;
  const { tabla } = req.params;

  const tablasPermitidas = ['ventas', 'cambios', 'cuentas'];
  if (!tablasPermitidas.includes(tabla)) {
    return res.status(400).json({ error: 'Tabla no permitida' });
  }

  // Crear backup antes de borrar
  crearBackup(usuario, `Pre-limpieza ${tabla}`, `Antes de borrar todos los registros`);

  if (tabla === 'cuentas') {
    // Borrar también los movimientos
    db.run('DELETE FROM movimientosCuentas', function(err) {
      if (err) console.error('Error borrando movimientos:', err);
      
      db.run('DELETE FROM cuentasCorrientes', function(err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        crearBackup(usuario, 'Limpieza cuentas', `Todas las cuentas corrientes eliminadas`);
        res.json({ ok: true, mensaje: 'Todas las cuentas corrientes eliminadas' });
      });
    });
  } else {
    db.run(`DELETE FROM ${tabla}`, function(err) {
      if (err) return res.status(500).json({ error: err.message });
      crearBackup(usuario, `Limpieza ${tabla}`, `${this.changes} registros eliminados`);
      res.json({ ok: true, mensaje: `${this.changes} registros de ${tabla} eliminados` });
    });
  }
});

// Poner todo el stock en 0 (sin borrar productos)
app.post('/api/admin/stock/zero', requireAuth, async (req, res) => {
  const db = req.db;
  const usuario = req.session.usuario;

  try {
    // Hacemos backup antes por las dudas
    crearBackup(usuario, 'Stock a Cero', 'Se reseteó el stock de todos los productos a 0');

    await dbRun(db, "BEGIN TRANSACTION");
    // Actualizamos todos los productos poniendo stock en 0
    await dbRun(db, "UPDATE productos SET stock = 0");
    await dbRun(db, "COMMIT");

    res.json({ ok: true, mensaje: 'Todo el stock ha sido actualizado a 0' });

  } catch (error) {
    console.error("Error reseteando stock:", error);
    await dbRun(db, "ROLLBACK");
    res.status(500).json({ error: error.message });
  }
});

// BORRAR TODOS LOS PRODUCTOS (VACIAR CATÁLOGO)
app.post('/api/admin/productos/eliminar-todos', requireAuth, async (req, res) => {
  const db = req.db;
  const usuario = req.session.usuario;

  try {
    crearBackup(usuario, 'Catálogo Eliminado', 'Se borraron todos los productos de la base de datos');

    await dbRun(db, "BEGIN TRANSACTION");
    // Borramos todos los registros de la tabla productos
    await dbRun(db, "DELETE FROM productos");
    await dbRun(db, "COMMIT");

    res.json({ ok: true, mensaje: 'Catálogo de productos vaciado correctamente.' });

  } catch (error) {
    console.error("Error vaciando catálogo:", error);
    await dbRun(db, "ROLLBACK");
    
    // Si falla por Foreign Keys (porque hay ventas asociadas), avisamos
    if (error.message.includes('FOREIGN KEY')) {
        return res.status(400).json({ error: 'No se pueden borrar productos porque tienen ventas asociadas. Borrá las ventas primero o importá encima (Upsert).' });
    }
    res.status(500).json({ error: error.message });
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

// ==================== MOVIMIENTOS DE CAJA (EXTRA) ====================

// Obtener movimientos de un día
app.get('/api/caja/movimientos/:fecha', requireAuth, (req, res) => {
    const db = req.db; // <--- CORRECCIÓN IMPORTANTE
    const { fecha } = req.params;
    
    db.all("SELECT * FROM movimientosCaja WHERE fecha = ?", [fecha], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Registrar movimiento
app.post('/api/caja/movimiento', requireAuth, (req, res) => {
    const db = req.db; // <--- CORRECCIÓN IMPORTANTE
    const { fecha, tipo, monto, detalle } = req.body;
    
    db.run(
        "INSERT INTO movimientosCaja (fecha, tipo, monto, detalle) VALUES (?, ?, ?, ?)",
        [fecha, tipo, monto, detalle],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            // Backup opcional si tenés la función crearBackup disponible en este scope
            if (typeof crearBackup === 'function') {
                crearBackup(req.session.usuario, 'Movimiento Caja', `${tipo}: $${monto} (${detalle})`);
            }
            res.json({ id: this.lastID });
        }
    );
});

// Eliminar movimiento
app.delete('/api/caja/movimiento/:id', requireAuth, (req, res) => {
    const db = req.db; // <--- CORRECCIÓN IMPORTANTE
    
    db.run("DELETE FROM movimientosCaja WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Eliminado' });
    });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log('📌 Usuario por defecto: admin');
  console.log('📌 Contraseña por defecto: admin123');
});