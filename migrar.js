const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./datos.db', (err) => {
  if (err) {
    console.error('❌ Error abriendo BD:', err);
    process.exit(1);
  }
  console.log('✅ BD conectada');
});

db.serialize(() => {
  console.log('Agregando columnas nuevas a la tabla ventas...');

  db.run(`ALTER TABLE ventas ADD COLUMN descuento INTEGER DEFAULT 0`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column')) {
        console.log('⚠️  Columna descuento ya existe');
      } else {
        console.error('❌ Error agregando descuento:', err.message);
      }
    } else {
      console.log('✅ Columna descuento agregada');
    }
  });

  db.run(`ALTER TABLE ventas ADD COLUMN tipoPago TEXT`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column')) {
        console.log('⚠️  Columna tipoPago ya existe');
      } else {
        console.error('❌ Error agregando tipoPago:', err.message);
      }
    } else {
      console.log('✅ Columna tipoPago agregada');
    }

    // Cerrar BD después de la última operación
    setTimeout(() => {
      db.close(() => {
        console.log('\n🎉 Migración completa. Ahora podés arrancar el servidor con: npm start');
      });
    }, 100);
  });
});
