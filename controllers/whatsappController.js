const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Supabase config
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Memória volátil para sessões e QR Codes
const sessions = {};
const qrCodes = {};
const sessionStatus = {}; // Valores possíveis: not_started | starting | qr | connected | disconnected | error

// Função principal para iniciar uma sessão
async function startSession(sessionId) {
  if (sessions[sessionId]) {
    console.log(`⚠️ Sessão ${sessionId} já está ativa`);
    return;
  }

  try {
    const isRender = process.env.RENDER === 'true' || process.env.RENDER_EXTERNAL_URL;
    const basePath = isRender
      ? path.resolve('/tmp', 'auth')
      : path.resolve(__dirname, '..', 'whatsapp', 'auth');

    const sessionPath = path.resolve(basePath, sessionId);
    console.log(`📁 Caminho da sessão (${isRender ? 'RENDER' : 'LOCAL'}):`, sessionPath);

    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
      console.log(`✅ Pasta criada para sessão: ${sessionPath}`);
    }

    const testFile = path.join(sessionPath, 'test.txt');
    fs.writeFileSync(testFile, 'teste');
    fs.unlinkSync(testFile);

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
    });

    sessions[sessionId] = sock;
    sessionStatus[sessionId] = 'starting';

    sock.ev.on('creds.update', async () => {
      try {
        await saveCreds();
        console.log(`💾 Credenciais salvas com sucesso para sessão ${sessionId}`);
      } catch (err) {
        console.error(`❌ Erro ao salvar credenciais da sessão ${sessionId}:`, err.message);
      }
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, qr } = update;
      console.log(`🔁 Atualização de conexão para sessão ${sessionId}:`, update);

      if (qr && sessionStatus[sessionId] !== 'connected') {
        qrCodes[sessionId] = qr;
        sessionStatus[sessionId] = 'qr';
        console.log(`📱 QR Code gerado para ${sessionId}`);

        await supabase
          .from('whatsapp_sessions')
          .upsert({ session_id: sessionId, status: 'qr' }, { onConflict: 'session_id' });
      }

      if (connection === 'open') {
        sessionStatus[sessionId] = 'connected';
        console.log(`✅ Sessão ${sessionId} conectada com sucesso`);

        try {
          await saveCreds();
          console.log(`💾 Credenciais salvas forçadamente para sessão ${sessionId}`);
        } catch (err) {
          console.error(`❌ Erro ao forçar salvar credenciais:`, err.message);
        }

        if (sock.user) {
          const user = sock.user;
          console.log("👤 Usuário conectado:", user);

          await supabase
            .from('whatsapp_sessions')
            .upsert({
              session_id: sessionId,
              status: 'connected',
              phone: user.id || null,
              name: user.name || null
            }, { onConflict: 'session_id' });
        }
      }

      if (connection === 'close') {
        sessionStatus[sessionId] = 'disconnected';
        console.warn(`⚠️ Sessão ${sessionId} desconectada`);

        await supabase
          .from('whatsapp_sessions')
          .update({ status: 'disconnected' })
          .eq('session_id', sessionId);

        delete sessions[sessionId];
        setTimeout(() => startSession(sessionId), 3000);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
      const msg = messages[0];
      if (!msg.message) return;

      const sender = msg.key.remoteJid;
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

      console.log(`📨 Mensagem recebida de ${sender}: ${text}`);

      // Aqui você pode salvar mensagens no Supabase ou acionar bots personalizados
    });

  } catch (error) {
    sessionStatus[sessionId] = 'error';
    console.error(`❌ Erro ao iniciar sessão ${sessionId}:`, error.message);

    await supabase
      .from('whatsapp_sessions')
      .upsert({ session_id: sessionId, status: 'error' }, { onConflict: 'session_id' });

    throw error;
  }
}

// Retorna o QR Code atual da sessão
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
    return res.json({ qr: qrUrl });

  } catch (error) {
    console.error(`❌ Erro ao recuperar QR Code da sessão ${sessionId}:`, error.message);
    return res.status(500).json({ error: 'Erro ao obter QR Code', details: error.message });
  }
}

// Consulta o status atual da sessão
async function getSessionStatus(req, res) {
  const { id } = req.params;

  if (sessionStatus[id]) {
    return res.json({ status: sessionStatus[id] });
  }

  const { data, error } = await supabase
    .from('whatsapp_sessions')
    .select('status')
    .eq('session_id', id)
    .single();

  if (error) {
    console.error("❌ Erro ao buscar status no Supabase:", error.message);
    return res.status(500).json({ status: 'error' });
  }

  return res.json({ status: data?.status || 'not_started' });
}

module.exports = {
  startSession,
  getQRCode,
  getSessionStatus
};
