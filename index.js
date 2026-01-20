const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('--- ESCANEA EL QR EN LOS LOGS DE RAILWAY ---');
});

client.on('ready', () => console.log('✅ Bot Factor Fit Conectado'));

app.post('/enviar', async (req, res) => {
    const { numero, mensaje } = req.body;
    try {
        const chatId = numero.includes('@c.us') ? numero : `${numero}@c.us`;
        await client.sendMessage(chatId, mensaje);
        res.status(200).json({ status: 'Enviado' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Servidor en puerto ${port}`);
    client.initialize();
});