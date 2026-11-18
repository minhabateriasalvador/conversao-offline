import { neon } from '@neondatabase/serverless';

// ID do campo personalizado GCLID no GHL da Minha Bateria
const GHL_GCLID_FIELD_ID = 'MOG14QopyW0T9VWYwmHc';

export default async function handler(req, res) {
  const ghlApiKey = process.env.GHL_API_KEY;
  const ghlLocationId = process.env.GHL_LOCATION_ID || 'b7oDv7GlDzLKQQiLqvMD';
  const ghlBaseUrl = process.env.GHL_API_BASE_URL || 'https://services.leadconnectorhq.com';

  if (!ghlApiKey) {
    return res.status(500).json({ error: 'GHL_API_KEY ausente na Vercel.' });
  }

  try {
    // Parâmetros opcionais: ?dias=30 ou ?nome_conversao=Venda WhatsApp
    const { dias = 30, nome_conversao = 'Venda WhatsApp' } = req.query;
    const limiteDias = parseInt(dias, 10) || 30;
    const dataCorte = new Date(Date.now() - limiteDias * 24 * 60 * 60 * 1000);

    // 1. Busca oportunidades ganhas (status: won) na subconta
    // Buscamos via pipeline search ou opportunities search
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

    // 2. Para cada oportunidade ganha recente, busca o contato para ler o GCLID
    const linhasCsv = [];

    for (const opp of oportunidades) {
      const dataFechamento = new Date(opp.lastStatusChangeAt || opp.updatedAt || opp.createdAt);
      if (dataFechamento < dataCorte) continue;

      const contactId = opp.contact?.id || opp.contactId;
      if (!contactId) continue;

      // Busca dados do contato para extrair o GCLID
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

      // Procura o valor do GCLID nos campos personalizados
      const campoGclid = customFields.find(f => f.id === GHL_GCLID_FIELD_ID || f.fieldKey === 'contact.gclid_contact');
      const gclidValor = campoGclid ? String(campoGclid.value || campoGclid.field_value || '').trim() : '';

      // Só adiciona ao CSV se tiver GCLID válido
      if (gclidValor && !gclidValor.startsWith('SIMULADO_')) {
        // Formata data e hora no padrão Google Ads: yyyy-MM-dd HH:mm:ss
        const ano = dataFechamento.getFullYear();
        const mes = String(dataFechamento.getMonth() + 1).padStart(2, '0');
        const dia = String(dataFechamento.getDate()).padStart(2, '0');
        const hora = String(dataFechamento.getHours()).padStart(2, '0');
        const min = String(dataFechamento.getMinutes()).padStart(2, '0');
        const seg = String(dataFechamento.getSeconds()).padStart(2, '0');
        const conversionTime = `${ano}-${mes}-${dia} ${hora}:${min}:${seg}`;

        // Valor da venda (monetaryValue)
        const valor = Number(opp.monetaryValue || 0).toFixed(2);
        const orderId = opp.id; // Garante idempotência no Google Ads

        linhasCsv.push(`${gclidValor},${nome_conversao},${conversionTime},${valor},BRL,${orderId}`);
      }
    }

    // Se o usuário pedir formato JSON (para conferência em tela)
    if (req.query.formato === 'json') {
      return res.status(200).json({
        total_ganhas: oportunidades.length,
        total_com_gclid: linhasCsv.length,
        linhas: linhasCsv
      });
    }

    // 3. Monta o arquivo CSV oficial do Google Ads
    const cabecalhoGoogle = [
      'Parameters:TimeZone=America/Sao_Paulo',
      'Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency,Order ID'
    ];

    const conteudoCsv = cabecalhoGoogle.concat(linhasCsv).join('\r\n');

    // Força o download do arquivo .csv no navegador
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
