const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const cors = require('cors');
const pino = require('pino');
const QRCode = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json());

let lastQr = null;
let sock = null;

app.get('/qr', async (req, res) => {
    if (lastQr) {
        res.setHeader('Content-Type', 'image/png');
        await QRCode.toFileStream(res, lastQr);
    } else {
        res.status(404).send('Generando QR... Por favor refresca en 10 segundos.');
    }
});

app.get('/', (req, res) => res.send('🤖 Bot activo. Ve a /qr'));

async function startWhatsApp() {
    // CAMBIO: Nombre de sesión completamente nuevo para forzar limpieza en Railway
    const { state, saveCreds } = await useMultiFileAuthState('session_v2026_final');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        // CAMBIO: Emulamos una versión de Chrome y OS más reciente y estable
        browser: ['Mac OS', 'Chrome', '121.0.6167.184'],
        // Forzamos el uso de una versión de WA Web compatible
        version: [2, 3000, 1015901307],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            lastQr = qr;
            console.log('✨ ¡ÉXITO! QR generado. Míralo en /qr');
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log('❌ Error:', statusCode);
            lastQr = null;

            // Si el error es 405 o 401, hay que limpiar y reintentar
            if (statusCode !== 401) {
                setTimeout(() => startWhatsApp(), 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ BOT CONECTADO EXITOSAMENTE');
            lastQr = null;
        }
    });
}

startWhatsApp();

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Puerto: ${PORT}`));