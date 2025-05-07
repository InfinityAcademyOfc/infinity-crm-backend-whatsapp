const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const sessions = {};
const qrCodes = {};
const sessionStatus = {}; // not_started | starting | qr | connected | disconnected | error

async function startSession(sessionId) {
  if (!sessionId) throw new Error('ID da sessão é obrigatório.');

  if (sessions[sessionId]) {
    console.log(`⚠️ Sessão ${sessionId} já está ativa.`);
    return;
  }

  sessionStatus[sessionId] = 'starting';

  const isRender = process.env.RENDER === 'true' || !!process.env.RENDER_EXTERNAL_URL;
  const basePath = isRender
    ? path.resolve('/tmp', 'auth')
    : path.resolve(__dirname, '..', 'whatsapp', 'auth');
  const sessionPath = path.join(basePath, sessionId);

  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
    console.log(`📁 Pasta criada para sessão: ${sessionPath}`);
  }

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
      console.log(`💾 Credenciais salvas para ${sessionId}`);
    } catch (err) {
      console.error(`❌ Erro ao salvar creds:`, err.message);
    }
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr && sessionStatus[sessionId] !== 'connected') {
      qrCodes[sessionId] = qr;
      sessionStatus[sessionId] = 'qr';
      console.log(`📲 QR code gerado para ${sessionId}`);
    }

    if (connection === 'open') {
      sessionStatus[sessionId] = 'connected';
      delete qrCodes[sessionId];
      await saveCreds();

      if (sock.user) {
        const { id, name } = sock.user;
        const { error } = await supabase.from('whatsapp_sessions').upsert({
          session_id: sessionId,
          phone: id || null,
          name: name || null,
          profile_id: null,
          status: 'connected',
          is_connected: true,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'session_id',
        });

        if (error) {
          console.error(`❌ Erro ao salvar no Supabase:`, error.message);
        } else {
          console.log(`✅ Sessão salva no Supabase: ${sessionId}`);
        }
      }
    }

    if (connection === 'close') {
      sessionStatus[sessionId] = 'disconnected';
      console.warn(`⚠️ Sessão ${sessionId} desconectada.`);

      await supabase.from('whatsapp_sessions').update({
        status: 'disconnected',
        is_connected: false,
        updated_at: new Date().toISOString(),
      }).eq('session_id', sessionId);

      delete sessions[sessionId];

      setTimeout(() => {
        console.log(`🔁 Reiniciando sessão ${sessionId} em 3s...`);
        startSession(sessionId);
      }, 3000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg || !msg.message) return;

    const sender = msg.key.remoteJid;
    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      '[mensagem sem texto]';

    console.log(`💬 ${sessionId} :: ${sender} => ${text}`);
  });
}

async function getQRCode(req, res) {
  const sessionId = req.params.id;
  if (!sessionId) return res.status(400).json({ error: 'ID da sessão é obrigatório' });

  try {
    if (!sessions[sessionId]) {
      console.log(`🚀 Iniciando nova sessão ${sessionId}`);
      await startSession(sessionId);
    }

    const qr = qrCodes[sessionId];
    if (!qr) {
      return res.status(202).json({ message: 'QR Code ainda não disponível, aguarde...' });
    }

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=300x300`;
    return res.json({ qr: qrUrl });
  } catch (err) {
    console.error(`❌ Erro ao gerar QR Code: ${err.message}`);
    return res.status(500).json({ error: 'Erro ao gerar QR Code', details: err.message });
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
      .maybeSingle();

    if (error) {
      console.error(`❌ Erro ao consultar status no Supabase:`, error.message);
      return res.status(500).json({ status: 'error' });
    }

    return res.json({ status: data?.status || 'not_started' });
  } catch (err) {
    console.error(`❌ Erro ao obter status: ${err.message}`);
    return res.status(500).json({ status: 'error' });
  }
}

module.exports = {
  startSession,
  getQRCode,
  getSessionStatus,
};
