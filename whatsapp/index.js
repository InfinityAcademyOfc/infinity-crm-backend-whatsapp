const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');

async function startWhatsApp() {
  const authFolder = path.resolve(__dirname, 'auth');
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection }) => {
    if (connection === 'open') {
      console.log('✅ WhatsApp conectado com sucesso!');
    } else if (connection === 'close') {
      console.log('⚠️ Conexão encerrada. Tentando reconectar...');
      startWhatsApp(); // Tenta reconectar
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const sender = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

    console.log(`📩 Mensagem de ${sender}: ${text}`);
  });
}

module.exports = startWhatsApp;
