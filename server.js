const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Rotas do Infinity CRM + WhatsApp
app.use('/profiles', require('./routes/profiles'));
app.use('/companies', require('./routes/companies'));
app.use('/config', require('./routes/config'));
app.use('/media', require('./routes/media'));
app.use('/lists', require('./routes/lists'));
app.use('/schedules', require('./routes/schedules'));
app.use('/chatbots', require('./routes/chatbots'));
app.use('/contacts', require('./routes/contacts'));

// Rotas específicas do módulo WhatsApp
app.use('/whatsapp_contacts', require('./routes/whatsapp_contacts'));
app.use('/whatsapp_messages', require('./routes/whatsapp_messages'));
app.use('/whatsapp_sessions', require('./routes/whatsapp_sessions'));
app.use('/whatsapp_flows', require('./routes/whatsapp_flows'));
app.use('/whatsapp_broadcasts', require('./routes/whatsapp_broadcasts'));
app.use('/whatsapp_autoresponders', require('./routes/whatsapp_autoresponders'));

// Rota padrão
app.get('/', (req, res) => {
  res.send('Servidor do Infinity CRM WhatsApp rodando com sucesso 🚀');
});

// Inicialização
app.listen(process.env.PORT || 3000, () => {
  console.log(`✅ Servidor iniciado: http://localhost:${process.env.PORT || 3000}`);
});
