const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, delay } = require('@whiskeysockets/baileys');
const cors = require('cors');
const pino = require('pino');
const QRCode = require('qrcode'); // <--- CAMBIO: Usaremos 'qrcode' para generar imágenes

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

let lastQr = null; // Aquí guardaremos el último QR generado

// Ruta para VER el QR como imagen en el navegador
app.get('/qr', async (req, res) => {
    if (lastQr) {
        res.setHeader('Content-Type', 'image/png');
        await QRCode.toFileStream(res, lastQr);
    } else {
        res.status(404).send('QR no disponible. Si ya escaneaste, el bot debería estar conectado.');
    }
});

app.get('/', (req, res) => res.send('🤖 Bot Factor Fit activo. Ve a /qr para ver el código.'));

let sock;

async function startWhatsApp() {
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
            console.log('✨ Nuevo QR generado. Míralo en: https://tu-url-de-railway.app/qr');
            lastQr = qr; // Guardamos el código para la ruta /qr
        }

        if (connection === 'close') {
            lastQr = null; // Limpiamos el QR si se cierra
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            console.log('🔄 Reintentando conexión...', shouldReconnect);
            if (shouldReconnect) setTimeout(() => startWhatsApp(), 5000);
        } else if (connection === 'open') {
            lastQr = null;
            console.log('✅ BOT CONECTADO');
        }
    });
}

startWhatsApp();

// Tu endpoint /enviar se mantiene igual...
app.post('/enviar', async (req, res) => {
    const { numero, mensaje } = req.body;
    try {
        const id = `${numero.replace(/\D/g, '')}@s.whatsapp.net`;
        await sock.sendMessage(id, { text: mensaje });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Puerto: ${PORT}`));