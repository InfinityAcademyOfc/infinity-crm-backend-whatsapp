const express = require('express');
const router = express.Router();
const { startSession, getQRCode } = require('../controllers/whatsappController');

// Iniciar uma sessão do WhatsApp
router.post('/:id/start', (req, res) => {
  const { id } = req.params;
  startSession(id);
  res.status(200).json({ message: `Sessão ${id} iniciada.` });
});

// Obter o QR Code da sessão
router.get('/:id/qrcode', getQRCode);

module.exports = router;
