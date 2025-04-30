const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// Rota GET /profiles
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
