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

        // 1. TABUĽKA: USERS (Používatelia)
        // Pridali sme email, role (admin/user) a created_at
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'user', -- 'admin' alebo 'user'
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. TABUĽKA: ROOMS (Miestnosti)
        db.run(`
            CREATE TABLE IF NOT EXISTS rooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 3. TABUĽKA: MESSAGES (Správy)
        // Pridali sme room_id a is_deleted pre tréning logického mazania
        db.run(`
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                room_id INTEGER DEFAULT 1, -- Predvolená miestnosť
                content TEXT NOT NULL,
                is_deleted INTEGER DEFAULT 0, -- 0 = viditeľná, 1 = vymazaná
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
            )
        `);

        // 4. TABUĽKA: USER_ROOMS (Kto je v ktorej miestnosti - Relácia M:N)
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

        // 5. TABUĽKA: MESSAGE_REACTIONS (Reakcie na správy)
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
        
        // Po inicializácii skúsime vložiť testovacie dáta
        seedData();
    });
}

function seedData() {
    db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
        if (err) return console.error('Chyba pri kontrole dát:', err.message);
        
        if (row.count === 0) {
            console.log('🌱 Databáza je prázdna, začínam nahrávať testovacie dáta...');
            
            const passHash = bcrypt.hashSync('heslo123', 10);
            
            // 1. Vložíme miestnosti
            db.run("INSERT INTO rooms (name) VALUES ('Všeobecné'), ('Programovanie'), ('Káva a relax')");

            // 2. Vložíme používateľov (zmes adminov a userov)
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

            const userStmt = db.prepare("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)");
            users.forEach(u => userStmt.run(u[0], u[1], passHash, u[2]));
            userStmt.finalize();

            // 3. Vložíme správy (rozdelené do miestností)
            setTimeout(() => {
                const messages = [
                    [1, 1, 'Ahojte, vitajte v QA Playgrounde!'],
                    [2, 1, 'Dnes sa ideme učiť SQL, teším sa.'],
                    [3, 1, 'Môže mi niekto vysvetliť JOIN?'],
                    [5, 1, 'Jasné, Janík, pozri sa na diagram v dokumentácii.'],
                    [4, 2, 'Kto tu rieši Node.js? Mám chybu v kóde.'],
                    [1, 2, 'Hoď to sem, pozrieme sa na to.'],
                    [6, 2, 'Mne nefunguje npm install...'],
                    [5, 3, 'Dáte si niekto kávu?'],
                    [7, 3, 'Ja si dám cappuccino, vďaka!'],
                    [8, 3, 'Už som mal tri, stačilo.'],
                    [2, 1, 'Skúšam poslať ďalšiu správu na test.'],
                    [3, 1, 'SQL je super, keď mu človek rozumie.'],
                    [4, 1, 'Nezabudnite na negatívne testovanie!'],
                    [1, 1, 'Táto správa bude neskôr vymazaná (logicky).'],
                    [6, 1, 'Práve som našiel bug!'],
                    [7, 1, 'Kde presne?'],
                    [6, 1, 'V registračnom formulári, neberie bodky v mene.'],
                    [5, 2, 'Máte už niekto hotové tie test-casy?'],
                    [2, 2, 'Ešte nie, bojujem s databázou.'],
                    [8, 1, 'Admin, môžeš pridať novú miestnosť pre Python?']
                ];

                const msgStmt = db.prepare("INSERT INTO messages (user_id, room_id, content) VALUES (?, ?, ?)");
                messages.forEach(m => msgStmt.run(m[0], m[1], m[2]));
                msgStmt.finalize();

                // 4. Označíme jednu správu ako vymazanú
                db.run("UPDATE messages SET is_deleted = 1 WHERE id = 14");

                // 5. Pridáme nejaké reakcie
                setTimeout(() => {
                    db.run("INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (1, 2, '👍'), (1, 3, '❤️'), (5, 1, '💻')");
                    console.log('✅ Testovacie dáta boli úspešne nahraté.');
                }, 500);
                
            }, 500);
        }
    });
}

module.exports = db;
