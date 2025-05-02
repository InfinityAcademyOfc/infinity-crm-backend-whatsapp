// controllers/whatsappController.js
const sessions = new Map();

const startSession = async (sessionId, io) => {
  const { default: makeWASocket, useSingleFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
  const fs = require('fs');
  const path = require('path');

  const authPath = path.resolve(__dirname, `../whatsapp/auth/${sessionId}.json`);
  const { state, saveState } = await useSingleFileAuthState(authPath);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveState);
  sock.ev.on('connection.update', (update) => {
    const { connection, qr } = update;

    if (qr) {
      sessions.get(sessionId).qr = qr;
    }

    if (connection === 'open') {
      sessions.get(sessionId).status = 'CONNECTED';
    } else if (connection === 'close') {
      sessions.get(sessionId).status = 'DISCONNECTED';
    }
  });

  sessions.set(sessionId, {
    socket: sock,
    qr: null,
    status: 'QRCODE'
  });

  return sock;
};

const getQRCode = async (req, res) => {
  const sessionId = req.params.id;

  if (!sessions.has(sessionId)) {
    await startSession(sessionId);
  }

  const session = sessions.get(sessionId);
  if (!session || !session.qr) {
    return res.status(404).json({ error: 'QR Code ainda não gerado' });
  }

  return res.json({ qrCode: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(session.qr)}` });
};

module.exports = {
  getQRCode,
  startSession,
  sessions,
};
