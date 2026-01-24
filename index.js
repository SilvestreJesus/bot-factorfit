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
    // CAMBIO: Usamos un nombre de sesión único para forzar limpieza
    const { state, saveCreds } = await useMultiFileAuthState('session_final_v1');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        // CAMBIO: Identidad de navegador más robusta
        browser: ['MacOS', 'Chrome', '121.0.6167.85'],
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            lastQr = qr;
            console.log('✨ QR LISTO EN /qr');
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log('❌ Conexión cerrada. Razón:', reason);
            lastQr = null;

            // Si no es un logout manual, reintentamos con un delay más largo
            if (reason !== DisconnectReason.loggedOut) {
                setTimeout(() => startWhatsApp(), 10000);
            }
        } else if (connection === 'open') {
            console.log('✅ BOT CONECTADO');
            lastQr = null;
        }
    });
}

startWhatsApp();

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Puerto: ${PORT}`));