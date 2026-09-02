const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = './database.sqlite';

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

async function createAdminAccount() {
  const username = 'admin';
  const password = 'admin123';

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    db.run(
      'INSERT INTO admin_accounts (username, password_hash) VALUES (?, ?)',
      [username, passwordHash],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint')) {
            console.log('Admin account already exists');
          } else {
            console.error('Error creating admin account:', err);
          }
        } else {
          console.log('Admin account created successfully!');
          console.log('Username:', username);
          console.log('Password:', password);
          console.log('Please change the password after first login.');
        }
        db.close();
      }
    );
  } catch (error) {
    console.error('Error:', error);
    db.close();
    process.exit(1);
  }
}

createAdminAccount();
