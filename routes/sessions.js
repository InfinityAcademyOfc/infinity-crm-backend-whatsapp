const express = require('express');
const router = express.Router();
const {
  startSession,
  getQRCode,
  getSessionStatus,
  deleteSession
} = require('../controllers/whatsappController');

// Iniciar uma sessão
router.post('/:id/start', async (req, res) => {
  const sessionId = req.params.id;

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'ID da sessão é obrigatório e deve ser uma string válida.' });
  }

  try {
    await startSession(sessionId);
    return res.status(200).json({ message: `Sessão ${sessionId} iniciada com sucesso.` });
  } catch (error) {
    console.error(`[ERRO] Iniciando sessão ${sessionId}:`, error.message);
    return res.status(500).json({ error: 'Erro ao iniciar sessão', details: error.message });
  }
});

// QR Code da sessão
router.get('/:id/qrcode', getQRCode);

// Status da sessão
router.get('/:id/status', getSessionStatus);

// Apagar a sessão
router.delete('/:id', deleteSession);

module.exports = router;
