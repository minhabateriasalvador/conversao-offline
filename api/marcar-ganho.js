// ID do campo personalizado "data horario" no GHL
const GHL_DATA_HORARIO_FIELD_ID = '1xyTbwoNC4gmmEv03WDT';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const ghlApiKey = process.env.GHL_API_KEY;
  const ghlBaseUrl = process.env.GHL_API_BASE_URL || 'https://services.leadconnectorhq.com';

  if (!ghlApiKey) {
    return res.status(500).json({ error: 'GHL_API_KEY ausente.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const contactId = body.contact_id || body.contactId || body.contact?.id;

    if (!contactId) {
      return res.status(400).json({ error: 'contact_id ausente no payload.' });
    }

    // Calcula a data e hora atual no fuso horário do Brasil (America/Sao_Paulo)
    // Formato exato exigido pelo Google Ads: yyyy-MM-dd HH:mm:ss
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

    // en-CA gera no formato YYYY-MM-DD, HH:mm:ss
    const partes = formatter.format(agora).replace(',', '');
    const dataHoraFormatadaGoogle = partes.trim();

    // Atualiza o campo "data horario" no contato do GHL
    const payloadGhl = {
      customFields: [
        { id: GHL_DATA_HORARIO_FIELD_ID, value: dataHoraFormatadaGoogle }
      ]
    };

    const respGhl = await fetch(`${ghlBaseUrl.replace(/\/$/, '')}/contacts/${encodeURIComponent(contactId)}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${ghlApiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payloadGhl)
    });

    if (!respGhl.ok) {
      const errTxt = await respGhl.text();
      throw new Error(`Falha ao gravar data_horario no GHL: ${respGhl.status} - ${errTxt}`);
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
