const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Rotas gerais do Infinity CRM + WhatsApp
app.use('/chatbots', require('./routes/chatbots'));

// ⚠️ Rota de sessões deve vir antes de chamadas do WhatsApp
app.use('/sessions', require('./routes/sessions'));
app.use('/messages', require('./routes/send_message')); // ou ajuste o caminho se necessário

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
