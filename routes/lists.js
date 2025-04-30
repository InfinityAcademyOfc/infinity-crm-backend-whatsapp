const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// GET todas as listas
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('lists').select('*');
  if (error) return res.status(500).json(error);
  res.json(data);
});

// POST nova lista
router.post('/', async (req, res) => {
  const { data, error } = await supabase.from('lists').insert([req.body]).select();
  if (error) return res.status(500).json(error);
  res.status(201).json(data[0]);
});

module.exports = router;
