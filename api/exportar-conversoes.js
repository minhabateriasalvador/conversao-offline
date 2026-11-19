import { createHash } from 'node:crypto';

// IDs oficiais dos Custom Fields da subconta Minha Bateria
const GHL_FIELD_IDS = {
  GCLID: 'MOG14QopyW0T9VWYwmHc',
  GBRAID: 'ijEMGMXnrDKL4uSisd84',
  WBRAID: 'oCqYlY6GRMUkqpFeKZE2',
  DATA_HORARIO: '1xyTbwoNC4gmmEv03WDT'
};

function formatarDataSP(date) {
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
  return formatter.format(date).replace(',', '').trim();
}

function mesAtualSP() {
  return formatarDataSP(new Date()).slice(0, 7); // YYYY-MM
}

function normalizarDataHora(valorCampo, fallbackDate) {
  const limpo = String(valorCampo || '').trim();
  // Formato já padrão Google Ads: YYYY-MM-DD HH:mm:ss
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(limpo)) {
    return limpo;
  }
  // Formato brasileiro salvo pelo /api/vincular: DD/MM/YYYY, HH:mm:ss
  const br = limpo.match(/^(\d{2})\/(\d{2})\/(\d{4})[,\s]+(\d{2}:\d{2}:\d{2})$/);
  if (br) {
    return `${br[3]}-${br[2]}-${br[1]} ${br[4]}`;
  }
  return formatarDataSP(fallbackDate);
}

function hashTelefoneE164(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 10) return '';
  const e164 = digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
  return createHash('sha256').update(e164).digest('hex');
}

function escaparCsv(valor) {
  const s = String(valor ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function renderizarPaginaHtml(mesPadrao) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exportar Conversões Offline — Google Ads</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body {
      background-color: #0b0f17;
      color: #f1f5f9;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 16px;
      padding: 36px 28px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .header { text-align: center; margin-bottom: 28px; }
    .badge {
      display: inline-block;
      background: #1e293b;
      color: #38bdf8;
      border: 1px solid #334155;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 4px 12px;
      border-radius: 9999px;
      margin-bottom: 14px;
    }
    h1 { font-size: 22px; font-weight: 700; color: #ffffff; margin-bottom: 8px; }
    .desc { font-size: 14px; color: #94a3b8; line-height: 1.5; }
    .field { margin-bottom: 18px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; }
    input[type="month"], input[type="text"] {
      width: 100%;
      background: #030712;
      color: #ffffff;
      border: 1px solid #374151;
      border-radius: 10px;
      padding: 12px 14px;
      font-size: 15px;
      outline: none;
      color-scheme: dark;
    }
    input[type="month"]:focus, input[type="text"]:focus { border-color: #38bdf8; }
    .checkbox-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: #030712;
      border: 1px solid #1f2937;
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 24px;
      cursor: pointer;
    }
    .checkbox-row input { margin-top: 3px; accent-color: #38bdf8; width: 16px; height: 16px; cursor: pointer; }
    .checkbox-text { font-size: 13px; color: #cbd5e1; line-height: 1.4; }
    .checkbox-hint { display: block; font-size: 11px; color: #64748b; margin-top: 3px; }
    .btn-primary {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      background: #000000;
      color: #ffffff;
      border: 1px solid #374151;
      padding: 16px 24px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-primary:hover:not(:disabled) {
      background: #111111;
      border-color: #38bdf8;
      transform: translateY(-1px);
    }
    .btn-primary:disabled { opacity: 0.6; cursor: wait; }
    .status-box {
      margin-top: 18px;
      padding: 12px 14px;
      border-radius: 10px;
      background: #030712;
      border: 1px solid #1f2937;
      font-size: 13px;
      color: #94a3b8;
      text-align: center;
      display: none;
    }
    .status-box.ok { display: block; color: #34d399; border-color: #065f46; }
    .status-box.warn { display: block; color: #fbbf24; border-color: #78350f; }
    .status-box.err { display: block; color: #f87171; border-color: #7f1d1d; }
    .cols-info {
      margin-top: 22px;
      padding-top: 16px;
      border-top: 1px solid #1f2937;
      font-size: 11px;
      color: #64748b;
      line-height: 1.6;
      text-align: center;
    }
    code { color: #94a3b8; background: #030712; padding: 2px 5px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">Google Ads Offline</span>
      <h1>Exportar Leads Ganhos</h1>
      <p class="desc">Selecione o mês de referência para baixar o CSV pronto para upload em Metas &rarr; Conversões &rarr; Uploads.</p>
    </div>

    <div class="field">
      <label for="mes">Mês das vendas ganhas</label>
      <input type="month" id="mes" value="${mesPadrao}">
    </div>

    <div class="field">
      <label for="nomeConversao">Nome da ação de conversão no Google Ads</label>
      <input type="text" id="nomeConversao" value="Conversão Offline - Whatsapp">
    </div>

    <label class="checkbox-row" for="incluirTelefone">
      <input type="checkbox" id="incluirTelefone">
      <span class="checkbox-text">
        Incluir telefone criptografado (SHA-256)
        <span class="checkbox-hint">Opcional. Para importação por GCLID não é necessário; marque apenas se sua ação usar Conversões Otimizadas para Leads.</span>
      </span>
    </label>

    <button id="btnBaixar" class="btn-primary" type="button">
      <span>Baixar leads ganhos</span>
    </button>

    <div id="statusBox" class="status-box"></div>

    <div class="cols-info">
      Colunas geradas: <code>Google Click ID</code>, <code>Conversion Name</code>, <code>Conversion Time</code>, <code>Conversion Value</code>, <code>Conversion Currency</code>, <code>Order ID</code>
    </div>
  </div>

  <script>
    const btn = document.getElementById('btnBaixar');
    const mesInput = document.getElementById('mes');
    const nomeInput = document.getElementById('nomeConversao');
    const telInput = document.getElementById('incluirTelefone');
    const statusBox = document.getElementById('statusBox');

    function setStatus(tipo, texto) {
      statusBox.className = 'status-box ' + tipo;
      statusBox.textContent = texto;
    }

    btn.addEventListener('click', async () => {
      const mes = mesInput.value;
      const nome = (nomeInput.value || 'Conversão Offline - Whatsapp').trim();
      const incluirTel = telInput.checked ? '1' : '0';

      if (!mes) {
        setStatus('warn', 'Selecione um mês válido.');
        return;
      }

      btn.disabled = true;
      setStatus('warn', 'Buscando vendas ganhas de ' + mes + ' no GoHighLevel...');

      try {
        const params = new URLSearchParams({
          mes,
          nome_conversao: nome,
          incluir_telefone: incluirTel,
          formato: 'json'
        });

        const resp = await fetch('/api/exportar-conversoes?' + params.toString());
        const data = await resp.json();

        if (!resp.ok) {
          throw new Error(data.error || 'Erro ao consultar vendas.');
        }

        if (data.total_com_gclid === 0) {
          setStatus('warn', 'Nenhuma venda ganha com GCLID encontrada em ' + mes + ' (total ganhas no mês: ' + data.total_ganhas_mes + ').');
          btn.disabled = false;
          return;
        }

        // Dispara o download do CSV
        const downloadParams = new URLSearchParams({
          mes,
          nome_conversao: nome,
          incluir_telefone: incluirTel,
          baixar: '1'
        });
        window.location.href = '/api/exportar-conversoes?' + downloadParams.toString();

        setStatus('ok', 'Download iniciado! ' + data.total_com_gclid + ' venda(s) com GCLID exportada(s) em ' + mes + '.');
      } catch (err) {
        setStatus('err', 'Erro: ' + (err.message || 'Falha na exportação.'));
      } finally {
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

async function buscarOportunidadesGanhas(ghlBaseUrl, ghlLocationId, ghlApiKey) {
  const todas = [];
  let nextUrl = `${ghlBaseUrl.replace(/\/$/, '')}/opportunities/search?location_id=${encodeURIComponent(ghlLocationId)}&status=won&limit=100`;
  let paginas = 0;

  // Pagina até 5 páginas (500 vendas ganhas) para não perder registros recentes
  while (nextUrl && paginas < 5) {
    paginas++;
    const resp = await fetch(nextUrl, {
      headers: {
        'Authorization': `Bearer ${ghlApiKey}`,
        'Version': '2021-07-28',
        'Accept': 'application/json'
      }
    });

    if (!resp.ok) {
      const errTxt = await resp.text();
      throw new Error(`Falha ao buscar oportunidades no GHL: ${resp.status} - ${errTxt}`);
    }

    const data = await resp.json();
    const lista = data.opportunities || [];
    todas.push(...lista);

    const meta = data.meta || {};
    if (meta.nextPageUrl && lista.length === 100) {
      nextUrl = meta.nextPageUrl;
    } else {
      nextUrl = null;
    }
  }

  return todas;
}

export default async function handler(req, res) {
  const {
    baixar,
    formato,
    mes,
    dias,
    nome_conversao = 'Conversão Offline - Whatsapp',
    incluir_telefone = '0'
  } = req.query;

  // Sem ?baixar=1 e sem ?formato=json -> renderiza a página HTML interativa
  if (baixar !== '1' && formato !== 'json') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(renderizarPaginaHtml(mesAtualSP()));
  }

  const ghlApiKey = process.env.GHL_API_KEY;
  const ghlLocationId = process.env.GHL_LOCATION_ID || 'b7oDv7GlDzLKQQiLqvMD';
  const ghlBaseUrl = process.env.GHL_API_BASE_URL || 'https://services.leadconnectorhq.com';

  if (!ghlApiKey) {
    return res.status(500).json({ error: 'GHL_API_KEY ausente na Vercel.' });
  }

  try {
    const mesSelecionado = typeof mes === 'string' && /^\d{4}-\d{2}$/.test(mes) ? mes : null;
    const limiteDias = !mesSelecionado ? (parseInt(dias, 10) || 30) : null;
    const dataCorte = limiteDias ? new Date(Date.now() - limiteDias * 24 * 60 * 60 * 1000) : null;
    const comTelefone = incluir_telefone === '1' || incluir_telefone === 'true';

    // 1. Busca oportunidades ganhas no GHL
    const oportunidades = await buscarOportunidadesGanhas(ghlBaseUrl, ghlLocationId, ghlApiKey);

    const linhasCsv = [];
    let totalGanhasNoFiltro = 0;

    // 2. Filtra pelo mês (ou janela de dias) e busca os campos do contato
    for (const opp of oportunidades) {
      const dataFechamento = new Date(opp.lastStatusChangeAt || opp.updatedAt || opp.createdAt);

      // Pré-filtro rápido por data da oportunidade (com margem de 2 dias caso data_horario difira)
      if (dataCorte && dataFechamento < dataCorte) continue;

      const contactId = opp.contact?.id || opp.contactId;
      if (!contactId) continue;

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

      const campoGclid = customFields.find(
        (f) => f.id === GHL_FIELD_IDS.GCLID || f.fieldKey === 'contact.gclid_contact'
      );
      const campoDataHorario = customFields.find(
        (f) => f.id === GHL_FIELD_IDS.DATA_HORARIO || f.fieldKey === 'contact.data_horario'
      );

      const gclidValor = campoGclid ? String(campoGclid.value || campoGclid.field_value || '').trim() : '';
      const conversionTime = normalizarDataHora(
        campoDataHorario ? (campoDataHorario.value || campoDataHorario.field_value) : '',
        dataFechamento
      );

      // Filtro exato por mês selecionado (YYYY-MM em horário de São Paulo/Salvador)
      if (mesSelecionado) {
        if (!conversionTime.startsWith(mesSelecionado)) continue;
      }

      totalGanhasNoFiltro++;

      // Só entra no CSV se tiver GCLID real (ignora testes SIMULADO_)
      if (gclidValor && !gclidValor.startsWith('SIMULADO_')) {
        const valor = Number(opp.monetaryValue || 0).toFixed(2);
        const orderId = opp.id;

        const colunas = [
          gclidValor,
          nome_conversao,
          conversionTime,
          valor,
          'BRL',
          orderId
        ];

        if (comTelefone) {
          colunas.push(hashTelefoneE164(contact.phone));
        }

        linhasCsv.push(colunas.map(escaparCsv).join(','));
      }
    }

    if (formato === 'json') {
      return res.status(200).json({
        mes: mesSelecionado,
        total_ganhas: oportunidades.length,
        total_ganhas_mes: totalGanhasNoFiltro,
        total_com_gclid: linhasCsv.length,
        incluir_telefone: comTelefone,
        linhas: linhasCsv
      });
    }

    const headerColunas = comTelefone
      ? 'Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency,Order ID,Phone Number'
      : 'Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency,Order ID';

    const cabecalhoGoogle = [
      'Parameters:TimeZone=America/Sao_Paulo',
      headerColunas
    ];

    const conteudoCsv = cabecalhoGoogle.concat(linhasCsv).join('\r\n');
    const sufixo = mesSelecionado || new Date().toISOString().slice(0, 10);
    const nomeArquivo = `conversoes-google-ads-${sufixo}.csv`;

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
