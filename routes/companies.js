const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// GET todas as empresas
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('companies').select('*');
  if (error) return res.status(500).json(error);
  res.json(data);
});

// POST nova empresa
router.post('/', async (req, res) => {
  const { name, address, cnpj } = req.body;
  const { data, error } = await supabase.from('companies').insert([{ name, address, cnpj }]);
  if (error) return res.status(500).json(error);
  res.status(201).json(data);
});

module.exports = router;
