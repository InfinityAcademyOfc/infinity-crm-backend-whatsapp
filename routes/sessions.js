// routes/sessions.js
const express = require('express');
const router = express.Router();
const { getQRCode } = require('../controllers/whatsappController');

router.get('/:id/qrcode', getQRCode);

module.exports = router;
