const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'reports.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  const createReportsTable = `
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      photo_url TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'resolved')),
      category TEXT DEFAULT 'OTHER',
      severity TEXT DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
      priority TEXT DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
      department TEXT DEFAULT 'General Administration',
      ai_analysis TEXT,
      ai_confidence INTEGER DEFAULT 0,
      estimated_cost TEXT DEFAULT 'Unknown',
      estimated_time TEXT DEFAULT 'Unknown',
      urgent BOOLEAN DEFAULT FALSE,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // Check if we need to add new columns to existing table
  db.all("PRAGMA table_info(reports)", (err, columns) => {
    if (err) {
      console.error('Error checking table structure:', err.message);
      return;
    }
    
    const columnNames = columns.map(col => col.name);
    const newColumns = [
      { name: 'category', type: 'TEXT DEFAULT "OTHER"' },
      { name: 'severity', type: 'TEXT DEFAULT "MEDIUM"' },
      { name: 'priority', type: 'TEXT DEFAULT "MEDIUM"' },
      { name: 'department', type: 'TEXT DEFAULT "General Administration"' },
      { name: 'ai_analysis', type: 'TEXT' },
      { name: 'ai_confidence', type: 'INTEGER DEFAULT 0' },
      { name: 'estimated_cost', type: 'TEXT DEFAULT "Unknown"' },
      { name: 'estimated_time', type: 'TEXT DEFAULT "Unknown"' },
      { name: 'urgent', type: 'BOOLEAN DEFAULT FALSE' }
    ];
    
    // Add missing columns
    newColumns.forEach(({ name, type }) => {
      if (!columnNames.includes(name)) {
        const alterQuery = `ALTER TABLE reports ADD COLUMN ${name} ${type}`;
        db.run(alterQuery, (err) => {
          if (err) {
            console.error(`Error adding column ${name}:`, err.message);
          } else {
            console.log(`Added column: ${name}`);
          }
        });
      }
    });
  });

  db.run(createReportsTable, (err) => {
    if (err) {
      console.error('Error creating reports table:', err.message);
    } else {
      console.log('Reports table created or already exists');
    }
  });
}

module.exports = db;