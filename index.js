const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, delay } = require('@whiskeysockets/baileys');
const cors = require('cors');
const pino = require('pino');
const QRCode = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

let lastQr = null; 

// Ruta para ver el QR: https://tu-app.railway.app/qr
app.get('/qr', async (req, res) => {
    if (lastQr) {
        res.setHeader('Content-Type', 'image/png');
        await QRCode.toFileStream(res, lastQr);
    } else {
        res.status(404).send('QR no disponible. Si ya escaneaste, el bot ya debería estar conectado.');
    }
});

app.get('/', (req, res) => res.send('🤖 Bot Factor Fit activo. Ve a /qr para vincular.'));

let sock;

async function startWhatsApp() {
    // La carpeta 'auth' guarda tu sesión
    const { state, saveCreds } = await useMultiFileAuthState('auth');
    
    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Factor Fit Bot', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            lastQr = qr;
            console.log('✨ Nuevo QR generado. Míralo en tu navegador en la ruta /qr');
        }

        if (connection === 'close') {
            lastQr = null;
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            console.log('🔄 Conexión cerrada. Reintentando...', shouldReconnect);
            if (shouldReconnect) {
                setTimeout(() => startWhatsApp(), 5000); // Espera 5s para no saturar
            }
        } else if (connection === 'open') {
            lastQr = null;
            console.log('✅ ✅ BOT CONECTADO EXITOSAMENTE ✅ ✅');
        }
    });
}

startWhatsApp();

app.post('/enviar', async (req, res) => {
    const { numero, mensaje } = req.body;
    if (!sock) return res.status(500).json({ ok: false, error: 'Socket no inicializado' });

    try {
        const id = `${numero.replace(/\D/g, '')}@s.whatsapp.net`;
        await sock.sendMessage(id, { text: mensaje });
        res.json({ ok: true, message: 'Mensaje enviado' });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor en puerto ${PORT}`));