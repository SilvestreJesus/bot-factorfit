const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, delay } = require('@whiskeysockets/baileys');
const cors = require('cors');
const pino = require('pino');
const qrcode = require('qrcode-terminal'); // Importante para ver el QR

const app = express();
app.use(cors()); // Permite que tu Angular se conecte
app.use(express.json({ limit: '50mb' }));

let sock;

async function startWhatsApp() {
    // 1. Gestión de sesión persistente
    const { state, saveCreds } = await useMultiFileAuthState('auth');
    
    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Factor Fit Bot', 'Chrome', '1.0.0'] // Identificador del bot
    });

    sock.ev.on('creds.update', saveCreds);

    // 2. Monitor de conexión y generador de QR
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Si hay un QR nuevo, lo dibujamos en la consola de Railway
        if (qr) {
            console.log('👇 ESCANEA ESTE CÓDIGO QR CON TU WHATSAPP 👇');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            console.log('🔄 Conexión cerrada. Reintentando:', shouldReconnect);
            if (shouldReconnect) startWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ ✅ BOT DE FACTOR FIT CONECTADO ✅ ✅');
        }
    });
}

startWhatsApp();

// 3. Endpoint para recibir órdenes de Angular
app.post('/enviar', async (req, res) => {
    const { numero, mensaje } = req.body;

    if (!sock) {
        return res.status(500).json({ ok: false, error: 'El bot no está inicializado' });
    }

    try {
        // Limpiamos el número y le damos formato de WhatsApp
        const numeroLimpio = numero.replace(/\D/g, '');
        const id = `${numeroLimpio}@s.whatsapp.net`;
        
        await sock.sendMessage(id, { text: mensaje });
        
        // Pausa de seguridad para evitar baneos
        await delay(2500); 

        res.json({ ok: true, message: 'Enviado correctamente' });
    } catch (err) {
        console.error('Error al enviar:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

// Usar el puerto que asigne Railway o el 3000 por defecto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));