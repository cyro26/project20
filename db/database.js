const mysql = require('mysql2');
require('dotenv').config();

// Konfigurácia pripojenia k MySQL serveru
// Údaje sa načítavajú zo súboru .env pre vyššiu bezpečnosť
const connectionConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'qa_user',
    password: process.env.DB_PASSWORD || 'heslo123',
    database: process.env.DB_NAME || 'chatapp',
    port: process.env.DB_PORT || 3306
};

// Vytvorenie pripojenia (Connection Pool je lepší pre webové aplikácie)
const pool = mysql.createPool(connectionConfig).promise();

async function initializeDatabase() {
    try {
        console.log('🛠️ Inicializujem MySQL databázovú schému...');

        // 1. Tabuľka Používateľov
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Tabuľka Miestností
        await pool.query(`
            CREATE TABLE IF NOT EXISTS rooms (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 3. Tabuľka Správ
        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                room_id INT DEFAULT 1,
                content TEXT NOT NULL,
                is_deleted TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // 4. Tabuľka User-Rooms (kto je v ktorej miestnosti)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_rooms (
                user_id INT NOT NULL,
                room_id INT NOT NULL,
                PRIMARY KEY (user_id, room_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
            )
        `);

        // 5. Tabuľka Reakcií na správy
        await pool.query(`
            CREATE TABLE IF NOT EXISTS message_reactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                message_id INT NOT NULL,
                user_id INT NOT NULL,
                emoji VARCHAR(10) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        console.log('✅ MySQL schéma je pripravená (prázdna).');
        console.log('🏁 Inicializácia kompletne dokončená.');
    } catch (err) {
        console.error('❌ Chyba pri inicializácii MySQL:', err.message);
        console.log('⚠️ Tip pre testera: Skontroluj, či sú údaje v .env správne a či MySQL server na Pi beží.');
    }
}

// Spustíme inicializáciu hneď pri načítaní modulu
initializeDatabase();

module.exports = pool;
