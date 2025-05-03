// controllers/whatsappController.js
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const path = require('path');

const sessions = {};
const qrCodes = {};

// Inicia uma nova sessão ou retorna se já existir
async function startSession(sessionId) {
  if (sessions[sessionId]) {
    console.log(`⚠️ Sessão ${sessionId} já está ativa`);
    return;
  }

  try {
    const sessionPath = path.resolve(__dirname, '..', 'whatsapp', 'auth', sessionId);
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
    });

    sessions[sessionId] = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async ({ connection, qr }) => {
      if (qr) {
        qrCodes[sessionId] = qr;
        console.log(`📱 Novo QR Code gerado para sessão ${sessionId}`);
      }

      if (connection === 'open') {
        console.log(`✅ Sessão ${sessionId} conectada com sucesso`);
      } else if (connection === 'close') {
        console.log(`⚠️ Sessão ${sessionId} desconectada. Reconectando...`);
        delete sessions[sessionId];
        await startSession(sessionId);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
      const msg = messages[0];
      if (!msg.message) return;

      const sender = msg.key.remoteJid;
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

      console.log(`📨 Mensagem recebida de ${sender}: ${text}`);
    });

  } catch (error) {
    console.error(`❌ Erro ao iniciar sessão ${sessionId}:`, error);
    throw error;
  }
}

// Retorna o QR Code em formato de URL
async function getQRCode(req, res) {
  const sessionId = req.params.id;

  try {
    if (!sessions[sessionId]) {
      console.log(`🚀 Iniciando nova sessão: ${sessionId}`);
      await startSession(sessionId);
    }

    const qr = qrCodes[sessionId];
    if (!qr) {
      console.log(`⏳ QR Code ainda não disponível para: ${sessionId}`);
      return res.status(202).json({ message: 'QR Code ainda não disponível, aguarde...' });
    }

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=300x300`;
    return res.json({ qrCode: qrUrl });

  } catch (error) {
    console.error(`❌ Erro ao recuperar QR Code da sessão ${sessionId}:`, error);
    return res.status(500).json({ error: 'Erro ao obter QR Code', details: error.message });
  }
}

module.exports = { startSession, getQRCode };
