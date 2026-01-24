const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, delay, disconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
app.use(express.json({ limit: '50mb' }));

let sock;

async function startWhatsApp() {
    // 1. Cargamos la sesión (Asegúrate de que la carpeta 'auth' esté en tu .gitignore)
    const { state, saveCreds } = await useMultiFileAuthState('auth');
    
    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }), // Evita llenar la consola de basura
        printQRInTerminal: true // Para que escanees el QR en la consola de Railway
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            console.log('Conexión cerrada, reintentando:', shouldReconnect);
            if (shouldReconnect) startWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ Bot de WhatsApp Factor Fit conectado');
        }
    });
}

startWhatsApp();

// Endpoint para envíos individuales o masivos
app.post('/enviar', async (req, res) => {
    const { numero, mensaje } = req.body;

    try {
        // Limpiar número (solo dígitos)
        const id = numero.replace(/\D/g, '') + '@s.whatsapp.net';
        
        await sock.sendMessage(id, { text: mensaje });
        
        // Espera de 2-3 segundos para no ser detectado como spam
        await delay(2500); 

        res.json({ ok: true, message: 'Enviado con éxito' });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.listen(3000, () => console.log('🚀 Servidor de WhatsApp listo en puerto 3000'));