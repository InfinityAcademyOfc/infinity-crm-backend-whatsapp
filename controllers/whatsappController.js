// controllers/whatsappController.js
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const path = require('path');

const sessions = {};
const qrCodes = {};

async function startSession(sessionId) {
  const sessionPath = path.resolve(__dirname, '..', 'auth', sessionId);
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
  });

  sessions[sessionId] = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, qr }) => {
    if (qr) {
      qrCodes[sessionId] = qr;
      console.log(`📱 Novo QR Code para sessão ${sessionId}`);
    }

    if (connection === 'open') {
      console.log(`✅ Sessão ${sessionId} conectada!`);
    } else if (connection === 'close') {
      console.log(`🔁 Sessão ${sessionId} desconectada. Tentando reconectar...`);
      startSession(sessionId);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;
    const sender = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    console.log(`📨 Mensagem de ${sender}: ${text}`);
  });
}

function getQRCode(req, res) {
  const { id } = req.params;
  const qr = qrCodes[id];
  if (!qr) return res.status(404).json({ error: 'QR Code não encontrado' });

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=300x300`;
  res.json({ qrCode: qrUrl });
}

module.exports = { startSession, getQRCode };
