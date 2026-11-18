import { neon } from '@neondatabase/serverless';
import { gerarRefCurta, codificarParaInvisivel } from '../lib/ref-invisivel.js';

export default async function handler(req, res) {
  // CORS aberto para a própria Vercel e testes
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(500).json({ error: 'DATABASE_URL não configurada na Vercel.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { gclid, gbraid, wbraid, ads_account, landing_url, utm_source, utm_campaign, utm_term } = body;

    // Precisa ter pelo menos um identificador de clique para atribuir
    const clickId = gclid || gbraid || wbraid;
    if (!clickId) {
      return res.status(400).json({ error: 'Nenhum identificador de clique (gclid, gbraid ou wbraid) informado.' });
    }

    const sql = neon(dbUrl);

    // Gera ref com garantia de não colisão (tenta até 3 vezes)
    let ref = '';
    let gravado = false;
    let tentativas = 0;

    while (!gravado && tentativas < 3) {
      ref = gerarRefCurta();
      tentativas++;
      try {
        await sql`
          INSERT INTO google_ads_atribuicao (
            ref, gclid, gbraid, wbraid, ads_account, landing_url,
            utm_source, utm_campaign, utm_term, status
          ) VALUES (
            ${ref},
            ${gclid || null},
            ${gbraid || null},
            ${wbraid || null},
            ${ads_account || 'principal'},
            ${landing_url || null},
            ${utm_source || null},
            ${utm_campaign || null},
            ${utm_term || null},
            'capturado'
          )
        `;
        gravado = true;
      } catch (err) {
        // Se for erro de primary key (código repetido), tenta outro
        if (err.message && err.message.includes('unique')) {
          continue;
        }
        throw err;
      }
    }

    if (!gravado) {
      throw new Error('Falha ao gerar código único de atribuição após 3 tentativas.');
    }

    const invisivel = codificarParaInvisivel(ref);

    return res.status(200).json({
      success: true,
      ref,
      invisivel,
      gclid: gclid || null,
      gbraid: gbraid || null,
      wbraid: wbraid || null
    });

  } catch (error) {
    console.error('Erro ao gravar atribuição no Neon:', error);
    return res.status(500).json({
      error: 'Erro interno ao salvar atribuição.',
      detalhes: error.message
    });
  }
}
