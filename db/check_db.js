const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'chat_playground.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("--- USERS TABLE ---");
    db.all("PRAGMA table_info(users)", (err, rows) => {
        console.log(JSON.stringify(rows, null, 2));
    });

    console.log("--- MESSAGES TABLE ---");
    db.all("PRAGMA table_info(messages)", (err, rows) => {
        console.log(JSON.stringify(rows, null, 2));
    });

    console.log("--- ROOMS TABLE ---");
    db.all("PRAGMA table_info(rooms)", (err, rows) => {
        console.log(JSON.stringify(rows, null, 2));
    });
});
db.close();
