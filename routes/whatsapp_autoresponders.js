const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('whatsapp_autoresponders').select('*');
  if (error) return res.status(500).json(error);
  res.json(data);
});

router.post('/', async (req, res) => {
  const { data, error } = await supabase.from('whatsapp_autoresponders').insert([req.body]);
  if (error) return res.status(500).json(error);
  res.status(201).json(data);
});

module.exports = router;
