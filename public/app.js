// === DOM ELEMENTY ===
const authSection = document.getElementById('auth-section');
const chatSection = document.getElementById('chat-section');
const userControls = document.getElementById('user-controls');
const currentUsernameDisplay = document.getElementById('current-username');
const errorToast = document.getElementById('error-toast');

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const logoutBtn = document.getElementById('logout-btn');

const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');
const refreshChatBtn = document.getElementById('refresh-chat-btn');

// === STAV APLIKÁCIE ===
let currentUser = null; // Uchováva informácie o prihlásenom užívateľovi

// === POMOCNÉ FUNKCIE (Pre UI testovanie) ===
// TESTER POZNÁMKA: Tieto funkcie menia zobrazenie. Všimni si, že toast správa sama zmizne po 3 sekundách.
function showError(message) {
    errorToast.textContent = message;
    errorToast.classList.remove('hidden');
    setTimeout(() => {
        errorToast.classList.add('hidden');
    }, 3000);
}

function updateUI() {
    if (currentUser) {
        // Používateľ je prihlásený -> Zobraz chat, skry prihlásenie
        authSection.classList.add('hidden');
        chatSection.classList.remove('hidden');
        userControls.style.display = 'block';
        currentUsernameDisplay.textContent = currentUser.username;
        loadMessages(); // Ihneď načítame správy
    } else {
        // Používateľ nie je prihlásený
        authSection.classList.remove('hidden');
        chatSection.classList.add('hidden');
        userControls.style.display = 'none';
        currentUsernameDisplay.textContent = '';
        chatMessages.innerHTML = ''; // Vymažeme staré správy
    }
}

// === API VOLANIA (Komunikácia so serverom) ===

// 1. Kontrola prihlásenia pri načítaní stránky
async function checkAuth() {
    try {
        const res = await fetch('/api/me');
        if (res.ok) {
            currentUser = await res.json();
        }
    } catch (e) {
        console.error("Chyba spojenia", e);
    }
    updateUI();
}

// 2. Registrácia
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Zabráni refreshu stránky
    
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            showError(data.error || 'Chyba registrácie');
        } else {
            // Úspech! Automaticky ho rovno prihlásime
            alert('Registrácia úspešná! Teraz sa môžeš prihlásiť.');
            registerForm.reset();
        }
    } catch (e) {
        showError('Nepodarilo sa spojiť so serverom.');
    }
});

// 3. Prihlásenie
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            showError(data.error || 'Chyba prihlásenia');
        } else {
            // Sme prihlásení
            currentUser = { username: data.username };
            loginForm.reset();
            updateUI();
        }
    } catch (e) {
        showError('Nepodarilo sa spojiť so serverom.');
    }
});

// 4. Odhlásenie
logoutBtn.addEventListener('click', async () => {
    try {
        await fetch('/api/logout', { method: 'POST' });
        currentUser = null;
        updateUI();
    } catch (e) {
        showError('Chyba pri odhlasovaní.');
    }
});

// 5. Načítanie správ
async function loadMessages() {
    if (!currentUser) return;

    try {
        const res = await fetch('/api/messages');
        if (!res.ok) throw new Error('Nepodarilo sa načítať správy');
        
        const messages = await res.json();
        renderMessages(messages);
    } catch (e) {
        showError('Chyba pri načítavaní správ.');
    }
}

// Renderovanie správ do HTML
function renderMessages(messages) {
    chatMessages.innerHTML = ''; // Vyčistenie
    
    if (messages.length === 0) {
        chatMessages.innerHTML = '<div class="message-placeholder">Zatiaľ tu nie sú žiadne správy. Začni diskusiu!</div>';
        return;
    }

    messages.forEach(msg => {
        const isOwn = msg.username === currentUser.username;
        const msgDiv = document.createElement('div');
        msgDiv.className = `msg ${isOwn ? 'own' : ''}`;
        
        // Formátovanie času
        const timeStr = new Date(msg.created_at).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });

        msgDiv.innerHTML = `
            <div class="msg-author">${escapeHTML(msg.username)}</div>
            <div class="msg-content">${escapeHTML(msg.content)}</div>
            <div class="msg-time">${timeStr}</div>
        `;
        
        chatMessages.appendChild(msgDiv);
    });

    // Auto-scroll na spodok
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 6. Odoslanie správy
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = chatInput.value;

    try {
        const res = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        
        if (!res.ok) {
            const data = await res.json();
            showError(data.error || 'Správu sa nepodarilo odoslať');
        } else {
            chatInput.value = '';
            loadMessages(); // Znovu načíta všetky správy
        }
    } catch (e) {
        showError('Spojenie zlyhalo.');
    }
});

// Refresh tlačidlo pre chat
refreshChatBtn.addEventListener('click', loadMessages);

// Pomocná funkcia na ochranu pred XSS útokmi (Dobrý test-case pre testera!)
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// INICIALIZÁCIA PO NAČÍTANÍ
checkAuth();
