const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Cesta k databázovému súboru (vytvorí sa v rovnakej zložke ako tento skript)
const dbPath = path.resolve(__dirname, 'chat_playground.sqlite');

// Vytvorenie pripojenia k SQLite
// TESTER POZNÁMKA: Ak si stiahneš program DB Browser for SQLite, 
// môžeš si tento súbor (chat_playground.sqlite) otvoriť a pozerať sa priamo do tabuliek!
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Chyba pripojenia k databáze:', err.message);
    } else {
        console.log('✅ Úspešne pripojené k SQLite databáze.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    // Zapnutie cudzích kľúčov v SQLite (dôležité pre relácie medzi tabuľkami)
    db.run('PRAGMA foreign_keys = ON');

    // Vytvorenie tabuľky pre používateľov
    // TESTER POZNÁMKA: Všimni si stĺpec 'username', ktorý je UNIQUE - to znamená, 
    // že ak sa pokúsiš zaregistrovať rovnaké meno dvakrát, databáza vyhodí chybu (toto sa oplatí testovať!)
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('Chyba pri vytváraní tabuľky users:', err.message);
        else console.log('✅ Tabuľka "users" je pripravená.');
    });

    // Vytvorenie tabuľky pre správy
    // TESTER POZNÁMKA: Tu je relácia (FOREIGN KEY) na tabuľku users. 
    // Znamená to, že správa nemôže patriť používateľovi, ktorý neexistuje v databáze.
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) console.error('Chyba pri vytváraní tabuľky messages:', err.message);
        else console.log('✅ Tabuľka "messages" je pripravená.');
    });
}

// Exportujeme databázu, aby sme ju mohli používať v iných súboroch (napríklad v API)
module.exports = db;
