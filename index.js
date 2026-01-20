const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode'); // Nueva librería
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let ultimoQR = ""; // Aquí guardaremos el código para el navegador

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

// Evento QR: Lo muestra en consola Y lo guarda para la web
client.on('qr', async (qr) => {
    ultimoQR = qr; 
    qrcodeTerminal.generate(qr, { small: true });
    console.log('--- QR Generado. Míralo en el navegador ---');
});

client.on('ready', () => {
    ultimoQR = "CONNECTED";
    console.log('✅ Bot Factor Fit Conectado');
});

// RUTA PARA VER EL QR EN EL NAVEGADOR
app.get('/', async (req, res) => {
    if (ultimoQR === "CONNECTED") {
        res.send('<h1>✅ WhatsApp está conectado correctamente</h1>');
    } else if (ultimoQR) {
        // Genera una imagen del QR directamente en el HTML
        const qrImage = await QRCode.toDataURL(ultimoQR);
        res.send(`
            <div style="text-align:center; font-family:Arial;">
                <h1>Escanea el QR para Factor Fit</h1>
                <img src="${qrImage}" style="width:300px; border: 10px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.1);"/>
                <p>La página se actualizará automáticamente cuando conectes.</p>
                <script>setTimeout(() => location.reload(), 5000);</script>
            </div>
        `);
    } else {
        res.send('<h1>Iniciando... Espera unos segundos y recarga la página.</h1>');
    }
});

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