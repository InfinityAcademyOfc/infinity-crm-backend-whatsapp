const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
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
    console.log(`⚠️ Sessão ${sessionId} já ativa.`);
    return;
  }

  try {
    sessionStatus[sessionId] = 'starting';

    const isRender = process.env.RENDER === 'true' || !!process.env.RENDER_EXTERNAL_URL;
    const basePath = isRender ? path.resolve('/tmp', 'auth') : path.resolve(__dirname, '..', 'whatsapp', 'auth');
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
        console.log(`💾 Credenciais salvas: ${sessionId}`);
      } catch (err) {
        console.error(`❌ Erro ao salvar credenciais: ${err.message}`);
      }
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, qr, lastDisconnect } = update;

      if (qr && sessionStatus[sessionId] !== 'connected') {
        qrCodes[sessionId] = qr;
        sessionStatus[sessionId] = 'qr';

        console.log(`📱 QR gerado para sessão ${sessionId}`);
        await supabase.from('whatsapp_sessions').upsert(
          {
            session_id: sessionId,
            status: 'qr',
            qr_code: qr,
            is_connected: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'session_id' }
        );
      }

      if (connection === 'open') {
        sessionStatus[sessionId] = 'connected';
        delete qrCodes[sessionId];
        console.log(`✅ Conectado: ${sessionId}`);

        try {
          await saveCreds();
        } catch (err) {
          console.error(`❌ Erro ao salvar creds: ${err.message}`);
        }

        if (sock.user) {
          const { id: phone, name } = sock.user;
          const { error } = await supabase.from('whatsapp_sessions').upsert(
            {
              session_id: sessionId,
              status: 'connected',
              is_connected: true,
              qr_code: null,
              connected_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              phone,
              name,
            },
            { onConflict: 'session_id' }
          );

          if (error) {
            console.error(`❌ Erro ao salvar sessão no Supabase: ${error.message}`);
          } else {
            console.log(`✅ Sessão ${sessionId} atualizada no Supabase.`);
          }
        }

        fs.readdir(sessionPath, (err, files) => {
          if (err) console.error('❌ Erro ao ler pasta auth:', err);
          else {
            console.log(`📂 Pasta auth (${sessionId}) contém ${files.length} arquivos:`);
            files.forEach(f => console.log(` - ${f}`));
          }
        });
      }

      if (connection === 'close') {
        sessionStatus[sessionId] = 'disconnected';
        console.warn(`⚠️ Desconectado: ${sessionId}`);

        await supabase.from('whatsapp_sessions')
          .update({ status: 'disconnected', is_connected: false, updated_at: new Date().toISOString() })
          .eq('session_id', sessionId);

        delete sessions[sessionId];

        setTimeout(() => {
          console.log(`🔁 Reiniciando sessão ${sessionId} em 3s`);
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
      // Aqui você pode salvar no Supabase ou rodar o chatbot
    });

  } catch (err) {
    sessionStatus[sessionId] = 'error';
    console.error(`❌ Erro na sessão ${sessionId}:`, err);

    await supabase.from('whatsapp_sessions').upsert(
      { session_id: sessionId, status: 'error', updated_at: new Date().toISOString() },
      { onConflict: 'session_id' }
    );
  }
}

async function getQRCode(req, res) {
  const sessionId = req.params.id;
  if (!sessionId) return res.status(400).json({ error: 'ID da sessão é obrigatório' });

  try {
    if (!sessions[sessionId]) {
      console.log(`🚀 Iniciando nova sessão: ${sessionId}`);
      await startSession(sessionId);
    }

    const qr = qrCodes[sessionId];
    if (!qr) return res.status(202).json({ message: 'QR Code não disponível ainda' });

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=300x300`;
    return res.json({ qr: qrUrl });
  } catch (err) {
    console.error(`❌ Erro ao buscar QR: ${err.message}`);
    return res.status(500).json({ error: 'Erro ao gerar QR code', details: err.message });
  }
}

async function getSessionStatus(req, res) {
  const { id } = req.params;
  if (!id) return res.status(400).json({ status: 'invalid_request' });

  if (sessionStatus[id]) return res.json({ status: sessionStatus[id] });

  try {
    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .select('status')
      .eq('session_id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ status: 'not_started' });
    }

    return res.json({ status: data.status });
  } catch (err) {
    console.error(`❌ Erro ao buscar status: ${err.message}`);
    return res.status(500).json({ status: 'error' });
  }
}

module.exports = {
  startSession,
  getQRCode,
  getSessionStatus,
};
