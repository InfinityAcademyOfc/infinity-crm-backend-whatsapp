const express = require('express');
const router = express.Router();
const {
  startSession,
  getQRCode,
  getSessionStatus,
} = require('../controllers/whatsappController');

// Iniciar uma sessão manualmente
router.post('/:id/start', async (req, res) => {
  const { id } = req.params;

  if (!id) return res.status(400).json({ error: 'ID da sessão é obrigatório' });

  try {
    await startSession(id);
    res.status(200).json({ message: `Sessão ${id} iniciada com sucesso.` });
  } catch (error) {
    console.error(`Erro ao iniciar sessão ${id}:`, error);
    res.status(500).json({ error: 'Erro ao iniciar sessão', details: error.message });
  }
});

// Obter o QR Code da sessão
router.get('/:id/qrcode', async (req, res) => {
  try {
    await getQRCode(req, res);
  } catch (error) {
    console.error(`Erro ao obter QR Code da sessão ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro interno ao obter QR Code' });
  }
});

// Verificar status da sessão
router.get('/:id/status', async (req, res) => {
  try {
    await getSessionStatus(req, res);
  } catch (error) {
    console.error(`Erro ao verificar status da sessão ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro interno ao verificar status da sessão' });
  }
});

module.exports = router;
