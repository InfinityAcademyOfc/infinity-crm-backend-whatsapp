const path = require('path');
const fs = require('fs');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const sessions = new Map(); // Mapa global de sessões

async function startSession(sessionId) {
  const authFolder = path.resolve(__dirname, 'auth', sessionId);

  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
  });

  // Eventos
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection }) => {
    if (connection === 'open') {
      console.log(`✅ Sessão "${sessionId}" conectada com sucesso!`);
    } else if (connection === 'close') {
      console.log(`⚠️ Sessão "${sessionId}" desconectada. Reconectando...`);
      startSession(sessionId);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const sender = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    console.log(`📩 [${sessionId}] Mensagem de ${sender}: ${text}`);
  });

  sessions.set(sessionId, sock);
}

// Função para pegar a instância
function getSession(sessionId) {
  return sessions.get(sessionId);
}

module.exports = {
  startSession,
  getSession
};
