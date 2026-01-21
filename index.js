const express = require('express');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');

const app = express();
app.use(express.json());

let sock;

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  sock = makeWASocket({ auth: state });

  sock.ev.on('creds.update', saveCreds);
}

start();

app.post('/enviar', async (req, res) => {
  const { numero, mensaje } = req.body;

  await sock.sendMessage(numero + '@s.whatsapp.net', { text: mensaje });
  res.json({ ok: true });
});

app.listen(3000, () => console.log('WhatsApp Service ON'));
