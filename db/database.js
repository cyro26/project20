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
    db.serialize(() => {
        // Zapnutie cudzích kľúčov
        db.run('PRAGMA foreign_keys = ON');

        // 1. TABUĽKA: USERS
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. TABUĽKA: ROOMS
        db.run(`
            CREATE TABLE IF NOT EXISTS rooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 3. TABUĽKA: MESSAGES
        db.run(`
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                room_id INTEGER DEFAULT 1,
                content TEXT NOT NULL,
                is_deleted INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
            )
        `);

        // 4. TABUĽKA: USER_ROOMS
        db.run(`
            CREATE TABLE IF NOT EXISTS user_rooms (
                user_id INTEGER NOT NULL,
                room_id INTEGER NOT NULL,
                joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, room_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
            )
        `);

        // 5. TABUĽKA: MESSAGE_REACTIONS
        db.run(`
            CREATE TABLE IF NOT EXISTS message_reactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                emoji TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        console.log('✅ Databázová schéma je pripravená.');
        
        // Spustíme seeding
        seedData();
    });
}

function seedData() {
    // Zmenil som podmienku: Ak je v databáze menej ako 5 používateľov, skúsime doplniť dáta.
    // To pomôže, ak bol seeding predtým prerušený.
    db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
        if (err) return console.error('Chyba pri kontrole dát:', err.message);
        
        if (row.count < 5) {
            console.log(`🌱 V databáze je len ${row.count} používateľov. Spúšťam seeding testovacích dát...`);
            
            const passHash = bcrypt.hashSync('heslo123', 10);
            
            db.serialize(() => {
                // 1. Vložíme miestnosti (IGNORE zabezpečí, že ak už existujú, kód nespadne)
                db.run("INSERT OR IGNORE INTO rooms (name) VALUES ('Všeobecné')");
                db.run("INSERT OR IGNORE INTO rooms (name) VALUES ('Programovanie')");
                db.run("INSERT OR IGNORE INTO rooms (name) VALUES ('Káva a relax')");

                // 2. Používatelia
                const users = [
                    ['admin_peto', 'peto@example.com', 'admin'],
                    ['tester_janik', 'janik@test.sk', 'user'],
                    ['zuzka_qa', 'zuzka@firma.cz', 'user'],
                    ['fero_dev', 'fero@dev.com', 'user'],
                    ['alena_senior', 'alena@pro.sk', 'admin'],
                    ['robo_junior', 'robo@start.sk', 'user'],
                    ['lucka_test', 'lucka@qa.com', 'user'],
                    ['martin_sql', 'martin@db.com', 'user']
                ];

                users.forEach(u => {
                    db.run("INSERT OR IGNORE INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)", 
                        [u[0], u[1], passHash, u[2]], (err) => {
                            if (err) console.error(`Chyba pri nahrávaní užívateľa ${u[0]}:`, err.message);
                        });
                });

                // 3. Správy
                const messages = [
                    [1, 1, 'Ahojte, vitajte v QA Playgrounde!'],
                    [2, 1, 'Dnes sa ideme učiť SQL, teším sa.'],
                    [3, 1, 'Môže mi niekto vysvetliť JOIN?'],
                    [5, 1, 'Jasné, Janík, pozri sa na diagram v dokumentácii.'],
                    [4, 2, 'Kto tu rieši Node.js? Mám chybu v kóde.'],
                    [1, 2, 'Hoď to sem, pozrieme sa na to.'],
                    [5, 3, 'Dáte si niekto kávu?'],
                    [7, 3, 'Ja si dám cappuccino, vďaka!'],
                    [2, 1, 'Skúšam poslať ďalšiu správu na test.'],
                    [4, 1, 'Nezabudnite na negatívne testovanie!'],
                    [1, 1, 'Táto správa bude neskôr vymazaná (logicky).'],
                    [6, 1, 'Práve som našiel bug!'],
                    [7, 1, 'Kde presne?'],
                    [5, 2, 'Máte už niekto hotové tie test-casy?'],
                    [8, 1, 'Admin, môžeš pridať novú miestnosť pre Python?']
                ];

                // Kontrola správ (ak nie sú žiadne, vložíme ich)
                db.get("SELECT COUNT(*) as count FROM messages", (err, msgRow) => {
                    if (msgRow.count < 10) {
                        messages.forEach(m => {
                            db.run("INSERT INTO messages (user_id, room_id, content) VALUES (?, ?, ?)", m, (err) => {
                                if (err) console.error('Chyba pri nahrávaní správy:', err.message);
                            });
                        });
                        // Označíme správu 11 ako vymazanú
                        db.run("UPDATE messages SET is_deleted = 1 WHERE id = 11");
                    }
                });

                // 4. Reakcie
                db.get("SELECT COUNT(*) as count FROM message_reactions", (err, reactRow) => {
                    if (reactRow.count === 0) {
                        db.run("INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (1, 2, '👍')");
                        db.run("INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (1, 3, '❤️')");
                    }
                });
            });

            console.log('✅ Seeding proces dobehol (skontroluj prípadné chyby vyššie).');
        } else {
            console.log('✅ Dáta v databáze už existujú, preskakujem seeding.');
        }
    });
}

module.exports = db;
