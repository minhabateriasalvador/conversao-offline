// IDs oficiais dos Custom Fields da subconta Minha Bateria
const GHL_FIELD_IDS = {
  GCLID: 'MOG14QopyW0T9VWYwmHc',
  GBRAID: 'ijEMGMXnrDKL4uSisd84',
  WBRAID: 'oCqYlY6GRMUkqpFeKZE2',
  DATA_HORARIO: '1xyTbwoNC4gmmEv03WDT'
};

export default async function handler(req, res) {
  const ghlApiKey = process.env.GHL_API_KEY;
  const ghlLocationId = process.env.GHL_LOCATION_ID || 'b7oDv7GlDzLKQQiLqvMD';
  const ghlBaseUrl = process.env.GHL_API_BASE_URL || 'https://services.leadconnectorhq.com';

  if (!ghlApiKey) {
    return res.status(500).json({ error: 'GHL_API_KEY ausente na Vercel.' });
  }

  try {
    const { dias = 30, nome_conversao = 'Venda WhatsApp' } = req.query;
    const limiteDias = parseInt(dias, 10) || 30;
    const dataCorte = new Date(Date.now() - limiteDias * 24 * 60 * 60 * 1000);

    // 1. Busca oportunidades ganhas (status: won)
    const respOpp = await fetch(
      `${ghlBaseUrl.replace(/\/$/, '')}/opportunities/search?location_id=${ghlLocationId}&status=won&limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${ghlApiKey}`,
          'Version': '2021-07-28',
          'Accept': 'application/json'
        }
      }
    );

    if (!respOpp.ok) {
      const errTxt = await respOpp.text();
      throw new Error(`Falha ao buscar oportunidades no GHL: ${respOpp.status} - ${errTxt}`);
    }

    const dataOpp = await respOpp.json();
    const oportunidades = dataOpp.opportunities || [];
    const linhasCsv = [];

    // 2. Itera sobre as oportunidades ganhas
    for (const opp of oportunidades) {
      const dataFechamento = new Date(opp.lastStatusChangeAt || opp.updatedAt || opp.createdAt);
      if (dataFechamento < dataCorte) continue;

      const contactId = opp.contact?.id || opp.contactId;
      if (!contactId) continue;

      // Busca dados do contato para extrair GCLID e data horario
      const respCont = await fetch(
        `${ghlBaseUrl.replace(/\/$/, '')}/contacts/${encodeURIComponent(contactId)}`,
        {
          headers: {
            'Authorization': `Bearer ${ghlApiKey}`,
            'Version': '2021-07-28',
            'Accept': 'application/json'
          }
        }
      );

      if (!respCont.ok) continue;

      const dataCont = await respCont.json();
      const contact = dataCont.contact || {};
      const customFields = contact.customFields || [];

      // Extrai os campos personalizados
      const campoGclid = customFields.find(f => f.id === GHL_FIELD_IDS.GCLID || f.fieldKey === 'contact.gclid_contact');
      const campoDataHorario = customFields.find(f => f.id === GHL_FIELD_IDS.DATA_HORARIO || f.fieldKey === 'contact.data_horario');

      const gclidValor = campoGclid ? String(campoGclid.value || campoGclid.field_value || '').trim() : '';
      let conversionTime = campoDataHorario ? String(campoDataHorario.value || campoDataHorario.field_value || '').trim() : '';

      // Se o campo data_horario não estiver preenchido, usa a data de alteração do status no GHL
      if (!conversionTime || conversionTime.length < 10) {
        const ano = dataFechamento.getFullYear();
        const mes = String(dataFechamento.getMonth() + 1).padStart(2, '0');
        const dia = String(dataFechamento.getDate()).padStart(2, '0');
        const hora = String(dataFechamento.getHours()).padStart(2, '0');
        const min = String(dataFechamento.getMinutes()).padStart(2, '0');
        const seg = String(dataFechamento.getSeconds()).padStart(2, '0');
        conversionTime = `${ano}-${mes}-${dia} ${hora}:${min}:${seg}`;
      }

      // Adiciona ao CSV se tiver GCLID válido
      if (gclidValor && !gclidValor.startsWith('SIMULADO_')) {
        const valor = Number(opp.monetaryValue || 0).toFixed(2);
        const orderId = opp.id; // Garante idempotência no Google Ads

        linhasCsv.push(`${gclidValor},${nome_conversao},${conversionTime},${valor},BRL,${orderId}`);
      }
    }

    if (req.query.formato === 'json') {
      return res.status(200).json({
        total_ganhas: oportunidades.length,
        total_com_gclid: linhasCsv.length,
        linhas: linhasCsv
      });
    }

    // Monta o arquivo CSV oficial do Google Ads
    const cabecalhoGoogle = [
      'Parameters:TimeZone=America/Sao_Paulo',
      'Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency,Order ID'
    ];

    const conteudoCsv = cabecalhoGoogle.concat(linhasCsv).join('\r\n');
    const nomeArquivo = `conversoes-google-ads-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    return res.status(200).send(conteudoCsv);

  } catch (error) {
    console.error('Erro ao exportar conversões:', error);
    return res.status(500).json({
      error: 'Erro interno ao exportar conversões.',
      detalhes: error.message
    });
  }
}
