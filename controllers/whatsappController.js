const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Supabase config
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const sessions = {};
const qrCodes = {};
const sessionStatus = {}; // 🔁 Status da sessão: not_started | qr | connected | disconnected

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
    sessionStatus[sessionId] = 'starting';

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async ({ connection, qr }) => {
      if (qr) {
        qrCodes[sessionId] = qr;
        sessionStatus[sessionId] = 'qr';
        console.log(`📱 Novo QR Code gerado para sessão ${sessionId}`);

        await supabase
          .from('whatsapp_sessions')
          .upsert({ session_id: sessionId, status: 'waiting_qr' }, { onConflict: 'session_id' });
      }

      if (connection === 'open') {
        sessionStatus[sessionId] = 'connected';
        console.log(`✅ Sessão ${sessionId} conectada com sucesso`);

        await supabase
          .from('whatsapp_sessions')
          .upsert({ session_id: sessionId, status: 'connected' }, { onConflict: 'session_id' });
      }

      if (connection === 'close') {
        sessionStatus[sessionId] = 'disconnected';
        console.log(`⚠️ Sessão ${sessionId} desconectada. Reconectando...`);

        await supabase
          .from('whatsapp_sessions')
          .update({ status: 'disconnected' })
          .eq('session_id', sessionId);

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
    sessionStatus[sessionId] = 'error';

    await supabase
      .from('whatsapp_sessions')
      .upsert({ session_id: sessionId, status: 'error' }, { onConflict: 'session_id' });

    throw error;
  }
}

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

    // Retorna o QR code em formato base64 embed
    const base64Qr = qr.startsWith("data:image") ? qr : `data:image/png;base64,${qr}`;
    return res.json({ qrCode: base64Qr });

  } catch (error) {
    console.error(`❌ Erro ao recuperar QR Code da sessão ${sessionId}:`, error);
    return res.status(500).json({ error: 'Erro ao obter QR Code', details: error.message });
  }
}

// Retorna o status da sessão
function getSessionStatus(req, res) {
  const { id } = req.params;
  const status = sessionStatus[id] || 'not_started';
  res.json({ status });
}

module.exports = { startSession, getQRCode, getSessionStatus };
