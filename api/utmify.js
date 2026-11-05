// Envia os pedidos do quiz para a Utmify (como "aguardando pagamento").
// A chave fica guardada na Vercel, na variável de ambiente UTMIFY_TOKEN.
// Comissão por kit (opcional, em reais): COMISSAO_1 e COMISSAO_2.
const URL_UTMIFY = "https://api.utmify.com.br/api-credentials/orders";
const PRODUTOS = {
  1: { id: "visao-leve-1", nome: "Óculos Visão Leve - 1 unidade", preco: 16990 },
  2: { id: "visao-leve-2", nome: "Óculos Visão Leve - 2 unidades", preco: 24990 },
};
const utc = d => d.toISOString().slice(0, 19).replace("T", " ");
const reais = v => (v ? Math.round(parseFloat(String(v).replace(",", ".")) * 100) : 0);

function montar(b, ip, teste) {
  const p = PRODUTOS[b.oferta === 2 || b.oferta === "2" ? 2 : 1];
  const fone = String(b.whats || "").replace(/\D/g, "");
  const u = b.utm || {};
  const t = k => (u[k] ? String(u[k]).slice(0, 300) : null);
  const com = reais(process.env["COMISSAO_" + (p.preco === 24990 ? 2 : 1)]) || p.preco;
  return {
    orderId: String(b.codigo || "VL" + Date.now()).slice(0, 40),
    platform: "Quiz Visão Leve",
    paymentMethod: "pix",
    status: "waiting_payment",
    createdAt: utc(new Date()),
    approvedDate: null,
    refundedAt: null,
    customer: {
      name: String(b.nome || "Cliente").slice(0, 120),
      email: (fone || "cliente") + "@cliente.galdigital.com.br",
      phone: fone ? "55" + fone : null,
      document: null,
      country: "BR",
      ...(ip ? { ip } : {}),
    },
    products: [{ id: p.id, name: p.nome, planId: null, planName: null, quantity: 1, priceInCents: p.preco }],
    trackingParameters: {
      src: t("src"), sck: t("sck"),
      utm_source: t("utm_source"), utm_campaign: t("utm_campaign"),
      utm_medium: t("utm_medium"), utm_content: t("utm_content"), utm_term: t("utm_term"),
    },
    commission: { totalPriceInCents: p.preco, gatewayFeeInCents: 0, userCommissionInCents: com, currency: "BRL" },
    isTest: !!teste,
  };
}

async function enviar(pedido, token) {
  const r = await fetch(URL_UTMIFY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-token": token },
    body: JSON.stringify(pedido),
  });
  return { ok: r.ok, status: r.status, texto: (await r.text()).slice(0, 300) };
}

module.exports = async (req, res) => {
  const token = process.env.UTMIFY_TOKEN;
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || null;

  // Abrir no navegador: oculos.galdigital.com.br/api/utmify  -> mostra se está conectado
  if (req.method === "GET") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (!token) return res.status(200).send("<h2>❌ Falta colocar a chave da Utmify na Vercel (UTMIFY_TOKEN).</h2>");
    try {
      const r = await enviar(montar({ nome: "Teste de conexão", whats: "62900000000", oferta: 1, codigo: "TESTE" }, ip, true), token);
      return res.status(200).send(r.ok
        ? "<h2>✅ Utmify conectada! Os pedidos do quiz vão aparecer lá.</h2>"
        : `<h2>⚠️ A Utmify recusou a chave (erro ${r.status}). Confira se copiou a chave inteira.</h2>`);
    } catch (e) {
      return res.status(200).send("<h2>⚠️ Não consegui falar com a Utmify agora. Tente de novo em alguns minutos.</h2>");
    }
  }

  if (req.method !== "POST") return res.status(405).end();
  if (!token) return res.status(200).json({ ok: false, motivo: "sem token" });
  try {
    let b = req.body;
    if (typeof b === "string") b = JSON.parse(b || "{}");
    const r = await enviar(montar(b || {}, ip, false), token);
    return res.status(200).json({ ok: r.ok, status: r.status });
  } catch (e) {
    return res.status(200).json({ ok: false });
  }
};
