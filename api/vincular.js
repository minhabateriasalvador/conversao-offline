import { neon } from '@neondatabase/serverless';
import { decodificarInvisivel } from '../lib/ref-invisivel.js';

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
    
    // Suporta tanto chaves diretas quanto os formatos padrão de webhook do GHL
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

    // 3. Atualiza o contato no GoHighLevel com os dados encontrados
    let ghlAtualizado = false;
    let ghlResposta = null;

    if (ghlApiKey) {
      // Formata a data para formato legível no campo data_horario (ex: 18/11/2026 17:40:00)
      const dataCriacao = new Date(atribuicao.criado_em);
      const dataFormatada = dataCriacao.toLocaleString('pt-BR', { timeZone: 'America/Bahia' });

      // Atualiza os campos personalizados do contato
      // No GHL v3 ou v2, usamos PUT /contacts/{id} com customFields
      const payloadGhl = {
        customFields: [
          { key: 'gclid_contact', field_value: atribuicao.gclid || '' },
          { key: 'gbraid_contact', field_value: atribuicao.gbraid || '' },
          { key: 'wbraid_contact', field_value: atribuicao.wbraid || '' },
          { key: 'cdigo_whatsapp', field_value: atribuicao.ref || '' },
          { key: 'data_horario', field_value: dataFormatada }
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
