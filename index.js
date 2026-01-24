const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, delay } = require('@whiskeysockets/baileys');
const cors = require('cors');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Ruta raíz para confirmar que el servidor vive
app.get('/', (req, res) => res.send('🤖 Bot de Factor Fit está en línea. Revisa los logs para el QR.'));

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
            console.log('\n👇 ESCANEA ESTE CÓDIGO QR 👇');
            // 'small: true' ayuda a que el QR no se rompa en la consola de Railway
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            console.log('🔄 Conexión cerrada. Reintentando en 5 segundos...', shouldReconnect);
            
            // IMPORTANTE: Esperar 5s evita que Railway te bloquee por reinicios infinitos
            if (shouldReconnect) {
                setTimeout(() => startWhatsApp(), 5000);
            }
        } else if (connection === 'open') {
            console.log('\n✅ ✅ ✅ BOT CONECTADO EXITOSAMENTE ✅ ✅ ✅\n');
        }
    });
}

startWhatsApp();

app.post('/enviar', async (req, res) => {
    const { numero, mensaje } = req.body;
    if (!sock) return res.status(500).json({ ok: false, error: 'Bot no listo' });

    try {
        const id = `${numero.replace(/\D/g, '')}@s.whatsapp.net`;
        await sock.sendMessage(id, { text: mensaje });
        await delay(2500); 
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
// '0.0.0.0' es vital para que Railway pueda exponer tu app al exterior
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor listo en puerto ${PORT}`));