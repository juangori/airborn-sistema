const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Conexión a la base de datos SQLite
const db = new sqlite3.Database('./datos.db', (err) => {
  if (err) {
    console.error('❌ Error abriendo BD:', err);
    process.exit(1);
  } else {
    console.log('✅ BD conectada');
  }
});

const csvPath = path.join(__dirname, 'productos.csv');

// Verificar que exista productos.csv
if (!fs.existsSync(csvPath)) {
  console.error('❌ No se encuentra productos.csv en la carpeta airborn-sistema');
  process.exit(1);
}

// Parser CSV que maneja comillas correctamente
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"' && (i === 0 || line[i-1] !== '\\')) {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Función para limpiar precios tipo "$199.990,00"
function parsePrecio(raw) {
  if (!raw || raw === '##########') return 0;
  let s = String(raw)
    .replace(/"/g, '')   // quita comillas
    .replace(/\$/g, '')  // quita símbolo $
    .trim();
  // quitar puntos de miles
  s = s.replace(/\./g, '');
  // convertir coma decimal a punto
  s = s.replace(/,/g, '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseStock(raw) {
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return isNaN(n) ? 0 : n;
}

// Leer CSV completo
const contenido = fs.readFileSync(csvPath, 'utf8');
const lineas = contenido.split(/\r?\n/).filter(l => l.trim() !== '');

// Quitar encabezado
const header = parseCSVLine(lineas[0]);
console.log('📋 Header detectado:', header);

let insertados = 0;
let errores = 0;

db.serialize(() => {
  // Crear tabla productos
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

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO productos
    (codigo, descripcion, categoria, precioPublico, costo, stock)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Procesar cada línea de datos (desde la 2da)
  for (let i = 1; i < lineas.length; i++) {
    const partes = parseCSVLine(lineas[i]);
    
    if (partes.length < 6) {
      console.log(`⚠️ Línea ${i+1} ignorada (columnas insuficientes): ${lineas[i].substring(0, 50)}...`);
      continue;
    }

    const codigo = (partes[0] || '').trim();
    const descripcion = (partes[1] || '').trim();
    const categoria = (partes[2] || '').trim();
    const precioPublico = parsePrecio(partes[3]);
    const costo = parsePrecio(partes[4]);
    const stock = parseStock(partes[5]);

    if (!codigo) {
      console.log(`⚠️ Línea ${i+1} sin código, ignorada`);
      continue;
    }

    stmt.run([codigo, descripcion, categoria, precioPublico, costo, stock], (err) => {
      if (err) {
        console.error(`❌ Error código ${codigo}:`, err.message);
        errores++;
      } else {
        insertados++;
        if (insertados <= 5 || insertados % 50 === 0) {
          console.log(`✅ ${codigo}: $${precioPublico.toLocaleString()} (stock: ${stock})`);
        }
      }
    });
  }

  stmt.finalize((err) => {
    if (err) console.error('❌ Error finalizando:', err.message);
    console.log(`\n🎉 IMPORTACIÓN TERMINADA:`);
    console.log(`✅ Productos insertados/actualizados: ${insertados}`);
    console.log(`❌ Errores: ${errores}`);
    db.close();
  });
});
