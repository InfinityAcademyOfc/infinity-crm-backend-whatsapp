const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// Listar fluxos de chatbot
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('chatbots').select('*');
  if (error) return res.status(500).json(error);
  res.json(data);
});

// Criar novo fluxo
router.post('/', async (req, res) => {
  const { trigger, condition_type, response, delay, media_url } = req.body;
  const { data, error } = await supabase.from('chatbots').insert([
    { trigger, condition_type, response, delay, media_url }
  ]);
  if (error) return res.status(500).json(error);
  res.json(data);
});

module.exports = router;
