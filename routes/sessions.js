const express = require('express');
const router = express.Router();
const {
  startSession,
  getQRCode,
  getSessionStatus,
} = require('../controllers/whatsappController');

// Inicia uma nova sessão manualmente
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

// Retorna o QR Code atual da sessão
router.get('/:id/qrcode', async (req, res) => {
  const sessionId = req.params.id;

  if (!sessionId) {
    return res.status(400).json({ error: 'ID da sessão é obrigatório.' });
  }

  try {
    await getQRCode(req, res);
  } catch (error) {
    console.error(`[ERRO] Obtendo QR Code da sessão ${sessionId}:`, error.message);
    return res.status(500).json({ error: 'Erro ao obter QR Code', details: error.message });
  }
});

// Retorna o status atual da sessão
router.get('/:id/status', async (req, res) => {
  const sessionId = req.params.id;

  if (!sessionId) {
    return res.status(400).json({ error: 'ID da sessão é obrigatório.' });
  }

  try {
    await getSessionStatus(req, res);
  } catch (error) {
    console.error(`[ERRO] Verificando status da sessão ${sessionId}:`, error.message);
    return res.status(500).json({ error: 'Erro ao verificar status da sessão', details: error.message });
  }
});

module.exports = router;
