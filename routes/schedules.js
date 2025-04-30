const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// Buscar agendamentos
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('schedules').select('*');
  if (error) return res.status(500).json(error);
  res.json(data);
});

// Criar novo agendamento
router.post('/', async (req, res) => {
  const { target, message, send_at, media_url } = req.body;
  const { data, error } = await supabase.from('schedules').insert([
    { target, message, send_at, media_url }
  ]);
  if (error) return res.status(500).json(error);
  res.json(data);
});

module.exports = router;
