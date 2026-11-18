import { neon } from '@neondatabase/serverless';
import { decodificarInvisivel } from '../lib/ref-invisivel.js';

// IDs oficiais dos Custom Fields da subconta Minha Bateria
const GHL_FIELD_IDS = {
  GCLID: 'MOG14QopyW0T9VWYwmHc',
  GBRAID: 'ijEMGMXnrDKL4uSisd84',
  WBRAID: 'oCqYlY6GRMUkqpFeKZE2',
  CODIGO_WHATSAPP: 'LLdYtNpi4vgl2MIOv3XR',
  DATA_HORARIO: '1xyTbwoNC4gmmEv03WDT'
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  const dbUrl = process.env.DATABASE_URL;
  const ghlApiKey = process.env.GHL_API_KEY;
  const ghlBaseUrl = process.env.GHL_API_BASE_URL || 'https://services.leadconnectorhq.com';

  if (!dbUrl) {
    return res.status(500).json({ error: 'DATABASE_URL ausente' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    
    // Suporta chaves diretas ou payload completo do GHL
    const contactId = body.contact_id || body.contactId || body.contact?.id;
    const messageText = body.message_body || body.message?.body || body.body || '';

    if (!contactId) {
      return res.status(400).json({ error: 'contact_id ausente no payload.' });
    }

    if (!messageText) {
      return res.status(200).json({ status: 'ignorado', motivo: 'mensagem sem texto' });
    }

    // 1. Tenta decodificar a referência invisível da mensagem
    const ref = decodificarInvisivel(messageText);

    if (!ref) {
      return res.status(200).json({
        status: 'ignorado',
        motivo: 'nenhum codigo invisivel encontrado na mensagem'
      });
    }

    // 2. Busca o registro no banco Neon
    const sql = neon(dbUrl);
    const rows = await sql`
      SELECT ref, gclid, gbraid, wbraid, criado_em, status
      FROM google_ads_atribuicao
      WHERE ref = ${ref}
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return res.status(200).json({
        status: 'nao_encontrado',
        ref,
        motivo: 'codigo invisivel decodificado mas nao encontrado no Neon'
      });
    }

    const atribuicao = rows[0];

    // 3. Atualiza o contato no GoHighLevel com os IDs corretos
    let ghlAtualizado = false;
    let ghlResposta = null;

    if (ghlApiKey) {
      const dataCriacao = new Date(atribuicao.criado_em);
      const dataFormatada = dataCriacao.toLocaleString('pt-BR', { timeZone: 'America/Bahia' });

      // Formato oficial do GHL v3 / v2: array de objetos { id, value }
      const customFields = [
        { id: GHL_FIELD_IDS.GCLID, value: atribuicao.gclid || '' },
        { id: GHL_FIELD_IDS.GBRAID, value: atribuicao.gbraid || '' },
        { id: GHL_FIELD_IDS.WBRAID, value: atribuicao.wbraid || '' },
        { id: GHL_FIELD_IDS.CODIGO_WHATSAPP, value: atribuicao.ref || '' },
        { id: GHL_FIELD_IDS.DATA_HORARIO, value: dataFormatada }
      ];

      const respGhl = await fetch(`${ghlBaseUrl.replace(/\/$/, '')}/contacts/${encodeURIComponent(contactId)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${ghlApiKey}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ customFields })
      });

      if (respGhl.ok) {
        ghlAtualizado = true;
        ghlResposta = await respGhl.json();
      } else {
        const errTxt = await respGhl.text();
        console.error('Falha ao atualizar contato no GHL:', respGhl.status, errTxt);
      }
    }

    // 4. Marca como vinculado no Neon
    await sql`
      UPDATE google_ads_atribuicao
      SET status = 'vinculado',
          vinculado_em = now(),
          ghl_contact_id = ${contactId}
      WHERE ref = ${ref}
    `;

    return res.status(200).json({
      success: true,
      ref,
      gclid: atribuicao.gclid,
      gbraid: atribuicao.gbraid,
      wbraid: atribuicao.wbraid,
      ghl_contact_id: contactId,
      ghl_atualizado: ghlAtualizado
    });

  } catch (error) {
    console.error('Erro na rota /api/vincular:', error);
    return res.status(500).json({
      error: 'Erro interno ao vincular atribuicao.',
      detalhes: error.message
    });
  }
}
