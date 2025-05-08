const express = require('express');
const router = express.Router();
const { sessions } = require('../controllers/whatsappController');
const supabase = require('../supabase');

// Envia uma mensagem via Baileys
router.post('/send', async (req, res) => {
  const { sessionId, number, message } = req.body;

  if (!sessionId || !number || !message) {
    return res.status(400).json({ error: 'Campos obrigatórios: sessionId, number, message' });
  }

  const sock = sessions[sessionId];

  if (!sock) {
    return res.status(404).json({ error: `Sessão ${sessionId} não encontrada ou não conectada.` });
  }

  try {
    // Envia a mensagem
    await sock.sendMessage(number, { text: message });

    // Salva no Supabase como enviada
    const { error } = await supabase.from('whatsapp_messages').insert([{
      session_id: sessionId,
      number,
      message,
      from_me: true,
      created_at: new Date().toISOString()
    }]);

    if (error) {
      console.warn("⚠️ Mensagem enviada, mas erro ao salvar:", error.message);
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Erro ao enviar mensagem:", err.message);
    res.status(500).json({ error: 'Erro ao enviar mensagem.' });
  }
});

module.exports = router;
