// ID do campo personalizado "data horario" no GHL
const GHL_DATA_HORARIO_FIELD_ID = '1xyTbwoNC4gmmEv03WDT';

// Memória rápida de últimos disparos para diagnóstico
let ultimosLogs = [];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Se for GET, exibe os últimos webhooks recebidos
  if (req.method === 'GET') {
    return res.status(200).json({ logs: ultimosLogs });
  }

  const ghlApiKey = process.env.GHL_API_KEY;
  const ghlBaseUrl = process.env.GHL_API_BASE_URL || 'https://services.leadconnectorhq.com';

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  
  // Registra o log do que o GHL enviou
  const logItem = {
    horario: new Date().toISOString(),
    bodyRecebido: body
  };
  ultimosLogs.unshift(logItem);
  if (ultimosLogs.length > 10) ultimosLogs.pop();

  const contactId = body.contact_id || body.contactId || body.contact?.id;

  if (!contactId) {
    return res.status(400).json({ error: 'contact_id ausente no payload.', recebido: body });
  }

  try {
    const agora = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const partes = formatter.format(agora).replace(',', '');
    const dataHoraFormatadaGoogle = partes.trim();

    if (ghlApiKey) {
      const payloadGhl = {
        customFields: [
          { id: GHL_DATA_HORARIO_FIELD_ID, value: dataHoraFormatadaGoogle }
        ]
      };

      await fetch(`${ghlBaseUrl.replace(/\/$/, '')}/contacts/${encodeURIComponent(contactId)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${ghlApiKey}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payloadGhl)
      });
    }

    return res.status(200).json({
      success: true,
      contact_id: contactId,
      data_horario: dataHoraFormatadaGoogle,
      opportunity_id: body.opportunity_id || null,
      value: body.value || null
    });

  } catch (error) {
    console.error('Erro na rota /api/marcar-ganho:', error);
    return res.status(500).json({
      error: 'Erro interno ao marcar data de ganho.',
      detalhes: error.message
    });
  }
}
