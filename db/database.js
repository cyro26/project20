const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// Cesta k databázovému súboru
const dbPath = path.resolve(__dirname, 'chat_playground.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Chyba pripojenia k databáze:', err.message);
    } else {
        console.log('✅ Úspešne pripojené k SQLite databáze.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    // Použijeme serialize, aby sme zaručili, že príkazy idú presne po sebe
    db.serialize(() => {
        console.log('🛠️ Inicializujem databázovú schému...');
        
        db.run('PRAGMA foreign_keys = ON');

        // 1. Tabuľky
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            room_id INTEGER DEFAULT 1,
            content TEXT NOT NULL,
            is_deleted INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS message_reactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            emoji TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        console.log('✅ Databázová schéma je hotová.');
        
        // 2. SEEDING (Nahrávanie dát)
        // Použijeme INSERT OR IGNORE - ak dáta existujú, nič sa nestane. Ak nie, vložia sa.
        console.log('🌱 Kontrolujem a nahrávam testovacie dáta...');
        
        const passHash = bcrypt.hashSync('heslo123', 10);

        // Miestnosti
        db.run("INSERT OR IGNORE INTO rooms (id, name) VALUES (1, 'Všeobecné')");
        db.run("INSERT OR IGNORE INTO rooms (id, name) VALUES (2, 'Programovanie')");
        db.run("INSERT OR IGNORE INTO rooms (id, name) VALUES (3, 'Káva a relax')");

        // Používatelia
        const users = [
            [1, 'admin_peto', 'peto@example.com', 'admin'],
            [2, 'tester_janik', 'janik@test.sk', 'user'],
            [3, 'zuzka_qa', 'zuzka@firma.cz', 'user'],
            [4, 'fero_dev', 'fero@dev.com', 'user'],
            [5, 'alena_senior', 'alena@pro.sk', 'admin'],
            [6, 'robo_junior', 'robo@start.sk', 'user']
        ];

        users.forEach(u => {
            db.run("INSERT OR IGNORE INTO users (id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)", 
                [u[0], u[1], u[2], passHash, u[3]]);
        });

        // Správy (len ak je tabuľka prázdna)
        db.get("SELECT COUNT(*) as count FROM messages", (err, row) => {
            if (row && row.count === 0) {
                const messages = [
                    [1, 1, 'Ahojte, vitajte v QA Playgrounde!'],
                    [2, 1, 'Dnes sa ideme učiť SQL, teším sa.'],
                    [3, 1, 'Môže mi niekto vysvetliť JOIN?'],
                    [5, 1, 'Jasné, Janík, pozri sa na diagram v dokumentácii.'],
                    [4, 2, 'Kto tu rieši Node.js? Mám chybu v kóde.'],
                    [1, 2, 'Hoď to sem, pozrieme sa na to.'],
                    [5, 3, 'Dáte si niekto kávu?'],
                    [6, 1, 'Práve som našiel bug!']
                ];
                messages.forEach(m => {
                    db.run("INSERT INTO messages (user_id, room_id, content) VALUES (?, ?, ?)", m);
                });
                console.log('✅ Testovacie správy boli nahraté.');
            }
        });

        console.log('🏁 Inicializácia kompletne dokončená.');
    });
}

module.exports = db;
