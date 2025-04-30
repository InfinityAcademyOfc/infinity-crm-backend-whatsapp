const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// GET - Listar todos os contatos
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('contacts').select('*');
  if (error) return res.status(500).json(error);
  res.json(data);
});

// POST - Criar novo contato
router.post('/', async (req, res) => {
  const { name, email, phone, tags, company_id } = req.body;
  const { data, error } = await supabase
    .from('contacts')
    .insert([{ name, email, phone, tags, company_id }]);
  if (error) return res.status(500).json(error);
  res.status(201).json(data);
});

// PUT - Atualizar contato
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const { data, error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', id);
  if (error) return res.status(500).json(error);
  res.json(data);
});

// DELETE - Remover contato
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('contacts').delete().eq('id', id);
  if (error) return res.status(500).json(error);
  res.status(204).send();
});

module.exports = router;
