const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// Buscar todas mensagens
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('messages').select('*');
  if (error) return res.status(500).json(error);
  res.json(data);
});

// Criar nova mensagem
router.post('/', async (req, res) => {
  const { from, to, content, type, status } = req.body;
  const { data, error } = await supabase.from('messages').insert([
    { from, to, content, type, status }
  ]);
  if (error) return res.status(500).json(error);
  res.json(data);
});

module.exports = router;
