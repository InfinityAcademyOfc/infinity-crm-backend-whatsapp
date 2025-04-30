const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// GET todos os registros de mídia
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('media').select('*');
  if (error) return res.status(500).json(error);
  res.json(data);
});

// POST novo item de mídia
router.post('/', async (req, res) => {
  const { data, error } = await supabase.from('media').insert([req.body]).select();
  if (error) return res.status(500).json(error);
  res.status(201).json(data[0]);
});

module.exports = router;
