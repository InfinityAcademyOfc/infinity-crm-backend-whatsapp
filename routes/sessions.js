const express = require('express');
const router = express.Router();
const {
  startSession,
  getQRCode,
  getSessionStatus,
} = require('../controllers/whatsappController');

// Iniciar uma sessão do WhatsApp manualmente
router.post('/:id/start', async (req, res) => {
  const { id } = req.params;

  try {
    await startSession(id);
    res.status(200).json({ message: `Sessão ${id} iniciada com sucesso.` });
  } catch (error) {
    console.error(`Erro ao iniciar sessão ${id}:`, error);
    res.status(500).json({ error: 'Erro ao iniciar sessão', details: error.message });
  }
});

// Obter o QR Code da sessão
router.get('/:id/qrcode', getQRCode);

// Verificar status da sessão (conectado, aguardando QR ou não iniciada)
router.get('/:id/status', getSessionStatus);

module.exports = router;
