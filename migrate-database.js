const sqlite3 = require('sqlite3').verbose();

const DB_PATH = './database.sqlite';

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

db.serialize(() => {
  db.run(`ALTER TABLE user_suggestions ADD COLUMN user_identifier TEXT`, (err) => {
    if (err) {
      if (err.message.includes('duplicate')) {
        console.log('Column user_identifier already exists');
      } else {
        console.error('Error adding user_identifier column:', err);
      }
    } else {
      console.log('Column user_identifier added successfully');
    }
  });

  db.run(`ALTER TABLE user_suggestions ADD COLUMN approved_at DATETIME`, (err) => {
    if (err) {
      if (err.message.includes('duplicate')) {
        console.log('Column approved_at already exists');
      } else {
        console.error('Error adding approved_at column:', err);
      }
    } else {
      console.log('Column approved_at added successfully');
    }
  });

  console.log('Database migration completed');
  db.close();
});
