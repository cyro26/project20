require('dotenv').config(); // Načítanie .env premenných
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const db = require('./db/database'); // Načítanie MySQL poolu

const app = express();
const PORT = 3000;

// === MIDDLEWARE ===
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'super-tajne-heslo-pre-qa-playground',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Musíš byť prihlásený pre túto akciu!' });
    }
    next();
}

// === REST API ENDPOINTY ===

// 1. REGISTRÁCIA (Iba meno a heslo podľa požiadavky)
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Používateľské meno aj heslo sú povinné.' });
    }
    if (username.length < 3 || password.length < 4) {
        return res.status(400).json({ error: 'Meno musí mať aspoň 3 znaky a heslo aspoň 4.' });
    }

    try {
        const hash = bcrypt.hashSync(password, 10);
        const sql = `INSERT INTO users (username, password_hash) VALUES (?, ?)`;
        
        const [result] = await db.query(sql, [username.trim(), hash]);
        
        res.status(201).json({ success: true, message: 'Registrácia úspešná!', userId: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Toto meno je už obsadené.' });
        }
        console.error(err);
        res.status(500).json({ error: 'Interná chyba servera.' });
    }
});

// 2. PRIHLÁSENIE
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Používateľské meno aj heslo sú povinné.' });
    }

    try {
        const sql = `SELECT * FROM users WHERE username = ?`;
        const [rows] = await db.query(sql, [username.trim()]);
        const user = rows[0];

        if (!user || !bcrypt.compareSync(password, user.password_hash)) {
            return res.status(401).json({ error: 'Nesprávne meno alebo heslo.' });
        }

        req.session.userId = user.id;
        req.session.username = user.username;
        
        res.json({ success: true, message: 'Prihlásenie úspešné!', username: user.username });
    } catch (err) {
        res.status(500).json({ error: 'Interná chyba servera.' });
    }
});

// 3. ODHLÁSENIE
app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true, message: 'Odhlásený.' });
    });
});

// 4. ZÍSKANIE PROFILU
app.get('/api/me', requireAuth, (req, res) => {
    res.json({ id: req.session.userId, username: req.session.username });
});

// 5. NAČÍTANIE SPRÁV
app.get('/api/messages', requireAuth, async (req, res) => {
    try {
        const sql = `
            SELECT m.id, m.content, m.created_at, u.username
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.is_deleted = 0
            ORDER BY m.created_at ASC
            LIMIT 100
        `;
        const [rows] = await db.query(sql);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Chyba pri načítaní správ.' });
    }
});

// 6. ODOSLANIE SPRÁVY
app.post('/api/messages', requireAuth, async (req, res) => {
    const { content } = req.body;
    
    if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Správa nesmie byť prázdna.' });
    }

    try {
        const sql = `INSERT INTO messages (user_id, content) VALUES (?, ?)`;
        const [result] = await db.query(sql, [req.session.userId, content.trim()]);
        
        res.status(201).json({ 
            success: true, 
            message: {
                id: result.insertId,
                content: content.trim(),
                username: req.session.username,
                created_at: new Date().toISOString()
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Správu sa nepodarilo uložiť.' });
    }
});

// Spustenie servera
app.listen(PORT, () => {
    console.log(`✅ QA Server beží na adrese: http://localhost:${PORT}`);
    console.log(`📡 MySQL pripojenie nakonfigurované.`);
});
