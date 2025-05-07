const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const sessions = {};
const qrCodes = {};
const sessionStatus = {};

async function startSession(sessionId) {
  if (!sessionId) throw new Error('ID da sessão é obrigatório.');
  if (sessions[sessionId]) return;

  sessionStatus[sessionId] = 'starting';

  const basePath = process.env.RENDER ? path.resolve('/tmp', 'auth') : path.resolve(__dirname, '..', 'whatsapp', 'auth');
  const sessionPath = path.join(basePath, sessionId);
  if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
  });

  sessions[sessionId] = sock;

  sock.ev.on('creds.update', async () => {
    try {
      await saveCreds();
    } catch (err) {
      console.error(`Erro ao salvar credenciais: ${err.message}`);
    }
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr && sessionStatus[sessionId] !== 'connected') {
      qrCodes[sessionId] = qr;
      sessionStatus[sessionId] = 'qr';
      console.log(`📱 QR gerado: ${sessionId}`);
      return; // ⚠️ Não salvar no Supabase ainda
    }

    if (connection === 'open') {
      sessionStatus[sessionId] = 'connected';
      delete qrCodes[sessionId];
      await saveCreds();

      if (sock.user) {
        const { id, name } = sock.user;
        await supabase.from('whatsapp_sessions').upsert(
          {
            session_id: sessionId,
            phone: id || null,
            name: name || null,
            status: 'connected',
            is_connected: true,
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          { onConflict: 'session_id' }
        );
        console.log(`✅ Conectado: ${sessionId}`);
      }
    }

    if (connection === 'close') {
      const reasonCode = lastDisconnect?.error?.output?.statusCode || 0;
      const isRestartable = reasonCode !== DisconnectReason.loggedOut;

      sessionStatus[sessionId] = 'disconnected';
      delete sessions[sessionId];

      await supabase.from('whatsapp_sessions').update({
        status: 'disconnected',
        is_connected: false,
        updated_at: new Date().toISOString()
      }).eq('session_id', sessionId);

      console.warn(`⚠️ Sessão ${sessionId} desconectada (${reasonCode}).`);

      if (isRestartable) {
        setTimeout(() => {
          console.log(`🔁 Reiniciando sessão ${sessionId}...`);
          startSession(sessionId);
        }, 3000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message) return;

    const sender = msg.key.remoteJid;
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || '[sem texto]';
    console.log(`💬 ${sessionId} :: ${sender} => ${text}`);
  });
}

async function getQRCode(req, res) {
  const sessionId = req.params.id;
  if (!sessionId) return res.status(400).json({ error: 'ID da sessão é obrigatório' });

  try {
    if (!sessions[sessionId]) {
      console.log(`🚀 Iniciando sessão ${sessionId}`);
      await startSession(sessionId);
    }

    const qr = qrCodes[sessionId];
    if (!qr) {
      return res.status(202).json({ message: 'QR Code ainda não disponível, aguarde...' });
    }

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=300x300`;
    return res.json({ qr: qrUrl });
  } catch (err) {
    console.error(`❌ Erro ao obter QR Code: ${err.message}`);
    return res.status(500).json({ error: 'Erro ao obter QR Code', details: err.message });
  }
}

async function getSessionStatus(req, res) {
  const { id } = req.params;
  if (!id) return res.status(400).json({ status: 'invalid_request' });

  try {
    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .select('status')
      .eq('session_id', id)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`❌ Erro Supabase status ${id}:`, error.message);
      return res.status(500).json({ status: 'error' });
    }

    return res.json({ status: data?.status || sessionStatus[id] || 'not_started' });
  } catch (err) {
    console.error(`❌ Erro ao obter status: ${err.message}`);
    return res.status(500).json({ status: 'error' });
  }
}

module.exports = {
  startSession,
  getQRCode,
  getSessionStatus
};
