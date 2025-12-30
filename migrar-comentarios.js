const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./datos.db', (err) => {
  if (err) {
    console.error('❌ Error abriendo BD:', err);
    process.exit(1);
  }
  console.log('✅ BD conectada');
});

db.serialize(() => {
  console.log('Agregando columna comentario a movimientosCuentas...');

  db.run(`ALTER TABLE movimientosCuentas ADD COLUMN comentario TEXT`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column')) {
        console.log('⚠️  Columna comentario ya existe');
      } else {
        console.error('❌ Error agregando comentario:', err.message);
      }
    } else {
      console.log('✅ Columna comentario agregada');
    }

    setTimeout(() => {
      db.close(() => {
        console.log('\n🎉 Migración completa');
      });
    }, 100);
  });
});
