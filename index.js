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
    const { state, saveCreds } = await useMultiFileAuthState('session_final_v1');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '110.0.5563.147'], // Cambiamos a Ubuntu para mejor compatibilidad en Docker
        connectTimeoutMs: 100000, // Aumentamos el tiempo de espera
        keepAliveIntervalMs: 30000,
        generateHighQualityLink: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            lastQr = qr;
            console.log('✨ QR RECIBIDO EXITOSAMENTE');
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log('❌ Error de conexión:', statusCode);
            lastQr = null;

            // Si el error es 408 (Timeout) o 515, reintentamos
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log('🔄 Reintentando en 5 segundos...');
                setTimeout(() => startWhatsApp(), 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ BOT CONECTADO Y LISTO');
            lastQr = null;
        }
    });
}

startWhatsApp();

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Puerto: ${PORT}`));