const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const db = require('./db/database'); // Načítanie nášho SQL súboru

const app = express();
const PORT = 3000;

// === MIDDLEWARE (Nastavenia servera) ===
app.use(cors());
app.use(express.json()); // Aby server rozumel formátu JSON (užitočné pre Postman!)
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'))); // Zdieľanie frontend súborov

// Nastavenie sessions (udržanie prihlásenia)
// TESTER POZNÁMKA: Ak pri testovaní zmažeš cookie "connect.sid" vo svojom prehliadači, 
// server ťa okamžite odhlási, pretože stratí tvoju reláciu. Skvelý test-case pre bezpečnosť!
app.use(session({
    secret: 'super-tajne-heslo-pre-qa-playground',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // Platnosť 1 deň
}));

// Pomocná funkcia (Middleware) na overenie, či je user prihlásený
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        // Z pohľadu API testovania očakávame 401 Unauthorized
        return res.status(401).json({ error: 'Musíš byť prihlásený pre túto akciu!' });
    }
    next();
}


// === REST API ENDPOINTY (Ideálne na testovanie cez Postman) ===

// 1. REGISTRÁCIA
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;

    // Kontrola vstupov (Dobrý cieľ pre negatívne testovanie v Postmane!)
    if (!username || !password) {
        return res.status(400).json({ error: 'Používateľské meno aj heslo sú povinné.' });
    }
    if (username.length < 3 || password.length < 4) {
        return res.status(400).json({ error: 'Meno musí mať aspoň 3 znaky a heslo aspoň 4.' });
    }

    // Bezpečnosť: Heslá do DB nikdy neukladáme ako čistý text, ale zahašované!
    const hash = bcrypt.hashSync(password, 10);

    // Surový SQL príkaz na uloženie do databázy
    const sql = `INSERT INTO users (username, password_hash) VALUES (?, ?)`;
    
    db.run(sql, [username.trim(), hash], function(err) {
        if (err) {
            // Ak uživateľ už existuje, SQLite vyhodí chybu "UNIQUE constraint failed"
            if (err.message.includes('UNIQUE')) {
                return res.status(409).json({ error: 'Toto meno je už obsadené.' });
            }
            return res.status(500).json({ error: 'Interná chyba servera.' });
        }
        res.status(201).json({ success: true, message: 'Registrácia úspešná!', userId: this.lastID });
    });
});

// 2. PRIHLÁSENIE
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Používateľské meno aj heslo sú povinné.' });
    }

    const sql = `SELECT * FROM users WHERE username = ?`;
    
    db.get(sql, [username.trim()], (err, user) => {
        if (err) return res.status(500).json({ error: 'Interná chyba servera.' });
        
        if (!user) {
            return res.status(401).json({ error: 'Nesprávne meno alebo heslo.' });
        }

        // Overenie hesla pomocou bcrypt
        const isValid = bcrypt.compareSync(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Nesprávne meno alebo heslo.' });
        }

        // Vytvorenie session
        req.session.userId = user.id;
        req.session.username = user.username;
        
        res.json({ success: true, message: 'Prihlásenie úspešné!', username: user.username });
    });
});

// 3. ODHLÁSENIE
app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true, message: 'Odhlásený.' });
    });
});

// 4. ZÍSKANIE PROFILU PRIHLÁSENÉHO POUŽÍVATEĽA
app.get('/api/me', requireAuth, (req, res) => {
    res.json({ id: req.session.userId, username: req.session.username });
});

// 5. NAČÍTANIE SPRÁV (S JOIN tabuľkou!)
app.get('/api/messages', requireAuth, (req, res) => {
    // TESTER POZNÁMKA: Tu používame SQL JOIN. Chceme načítať správy a k nim pripojiť 
    // meno používateľa z tabuľky 'users' na základe zhodného ID.
    const sql = `
        SELECT m.id, m.content, m.created_at, u.username
        FROM messages m
        JOIN users u ON m.user_id = u.id
        ORDER BY m.created_at ASC
        LIMIT 100
    `;
    
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Chyba pri načítaní správ.' });
        res.json(rows);
    });
});

// 6. ODOSLANIE NOVEJ SPRÁVY
app.post('/api/messages', requireAuth, (req, res) => {
    const { content } = req.body;
    
    if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Správa nesmie byť prázdna.' });
    }

    const sql = `INSERT INTO messages (user_id, content) VALUES (?, ?)`;
    
    db.run(sql, [req.session.userId, content.trim()], function(err) {
        if (err) return res.status(500).json({ error: 'Správu sa nepodarilo uložiť.' });
        
        // Vrátime úspech a údaje o uloženej správe
        res.status(201).json({ 
            success: true, 
            message: {
                id: this.lastID,
                content: content.trim(),
                username: req.session.username,
                created_at: new Date().toISOString()
            }
        });
    });
});

// Spustenie servera
app.listen(PORT, () => {
    console.log(`✅ QA Server beží na adrese: http://localhost:${PORT}`);
    console.log(`📡 API je pripravené pre tvoje Postman testy!`);
});
