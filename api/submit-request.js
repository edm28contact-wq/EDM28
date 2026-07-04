function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (req.body && typeof req.body === "string") {
    return JSON.parse(req.body);
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");

  if (!raw) {
    return {};
  }

  return JSON.parse(raw);
}

function pickBasket(body) {
  return body.selectedBasket || body.basket || body.panier || "standard";
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function euro(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) {
    return "0,00 EUR";
  }
  return `${amount.toFixed(2).replace(".", ",")} EUR`;
}

function normalizeTotals(body) {
  const totals = body.totals || {};

  return {
    laborBase: Number(totals.laborBase || body.laborBase || 0),
    basketExtra: Number(totals.basketExtra || body.basketExtra || 0),
    comboSaving: Number(totals.comboSaving || body.comboSaving || 0),
    j7Saving: Number(totals.j7Saving || body.j7Saving || 0),
    immobilisation: Number(totals.immobilisation || body.immobilisation || 0),
    laborAfter: Number(totals.laborAfter || body.totalMainOeuvre || 0),
    partsMin: Number(totals.partsMin || body.totalPiecesMin || 0),
    partsMax: Number(totals.partsMax || body.totalPiecesMax || 0),
    totalBefore: Number(totals.totalBefore || body.totalMin || 0),
    totalAllMin: Number(totals.totalAllMin || 0),
    totalAllMax: Number(totals.totalAllMax || 0),
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function buildServicesHtml(services) {
  if (!Array.isArray(services) || !services.length) {
    return "<li>Aucune prestation</li>";
  }

  return services
    .map((service) => `<li><strong>${escapeHtml(service.name || service.id || "Prestation")}</strong>${service.category ? ` — ${escapeHtml(service.category)}` : ""}</li>`)
    .join("");
}

function buildServicesText(services) {
  if (!Array.isArray(services) || !services.length) {
    return "- Aucune prestation";
  }

  return services
    .map((service) => `- ${service.name || service.id || "Prestation"}${service.category ? ` (${service.category})` : ""}`)
    .join("\n");
}

async function sendWithResend({ apiKey, fromEmail, toEmail, replyTo, subject, html, text }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      reply_to: replyTo || undefined,
      subject,
      html,
      text,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Resend HTTP ${response.status}`);
  }

  return data;
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      success: true,
      api: "submit-request",
      message: "Route demande active. Utilise POST pour envoyer une demande.",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Méthode non autorisée. Utilise POST.",
    });
  }

  try {
    const body = await readJsonBody(req);
    const basket = pickBasket(body);
    const totals = normalizeTotals(body);

    const normalizedRequest = {
      source: "SITE_EDM_AUTO_V3",
      createdAt: new Date().toISOString(),
      client: {
        firstName: body.client?.firstName || "",
        lastName: body.client?.lastName || "",
        phone: body.client?.phone || "",
        email: body.client?.email || "",
      },
      vehicle: {
        plate: body.vehicle?.plate || "",
        plateNormalized: body.vehicle?.plateNormalized || "",
        brand: body.vehicle?.brand || "",
        model: body.vehicle?.model || "",
        year: body.vehicle?.year || "",
        energy: body.vehicle?.energy || "",
        mileage: body.vehicle?.mileage || "",
      },
      services: Array.isArray(body.services) ? body.services : [],
      basket,
      selectedBasket: basket,
      notes: body.notes || "",
      totals: {
        laborBase: totals.laborBase,
        basketExtra: totals.basketExtra,
        comboSaving: totals.comboSaving,
        j7Saving: totals.j7Saving,
        immobilisation: totals.immobilisation,
        laborAfter: totals.laborAfter,
        partsMin: totals.partsMin,
        partsMax: totals.partsMax,
        totalAllMin: totals.totalAllMin,
        totalAllMax: totals.totalAllMax,
      },
      j7Accepted: Boolean(body.j7Accepted),
      refuseControl: Boolean(body.refuseControl),
      status: "Nouveau",
      note: "Demande envoyée depuis le site EDM AUTO.",
    };

    if (!normalizedRequest.client.firstName || !normalizedRequest.client.lastName || !normalizedRequest.client.phone || !normalizedRequest.client.email) {
      return res.status(400).json({
        success: false,
        error: "Informations client incomplètes.",
      });
    }

    if (!isValidEmail(normalizedRequest.client.email)) {
      return res.status(400).json({
        success: false,
        error: "Adresse email client invalide.",
      });
    }

    if (!normalizedRequest.vehicle.plate) {
      return res.status(400).json({
        success: false,
        error: "Plaque véhicule manquante.",
      });
    }

    if (!normalizedRequest.services.length) {
      return res.status(400).json({
        success: false,
        error: "Aucune prestation sélectionnée.",
      });
    }

    const resendApiKey = process.env.RESEND_API_KEY || "";
    const resendFromEmail = process.env.RESEND_FROM_EMAIL || "";
    const resendToEmail = process.env.RESEND_TO_EMAIL || "";

    if (!resendApiKey || !resendFromEmail || !resendToEmail) {
      return res.status(200).json({
        success: false,
        configured: false,
        error: "Variables Vercel RESEND_API_KEY, RESEND_FROM_EMAIL ou RESEND_TO_EMAIL manquantes.",
      });
    }

    const subject = `Nouvelle demande EDM AUTO - ${normalizedRequest.client.lastName} ${normalizedRequest.client.firstName} - ${normalizedRequest.vehicle.plate}`;
    const servicesHtml = buildServicesHtml(normalizedRequest.services);
    const servicesText = buildServicesText(normalizedRequest.services);
    const totalRange = normalizedRequest.totals.totalAllMin && normalizedRequest.totals.totalAllMax
      ? `${euro(normalizedRequest.totals.totalAllMin)} à ${euro(normalizedRequest.totals.totalAllMax)}`
      : euro(normalizedRequest.totals.laborAfter);

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h2>Nouvelle demande EDM AUTO</h2>
        <p>Une nouvelle demande a été envoyée depuis le site.</p>

        <h3>Client</h3>
        <ul>
          <li><strong>Nom :</strong> ${escapeHtml(normalizedRequest.client.lastName)}</li>
          <li><strong>Prénom :</strong> ${escapeHtml(normalizedRequest.client.firstName)}</li>
          <li><strong>Téléphone :</strong> ${escapeHtml(normalizedRequest.client.phone)}</li>
          <li><strong>Email :</strong> ${escapeHtml(normalizedRequest.client.email)}</li>
        </ul>

        <h3>Véhicule</h3>
        <ul>
          <li><strong>Plaque :</strong> ${escapeHtml(normalizedRequest.vehicle.plate)}</li>
          <li><strong>Marque :</strong> ${escapeHtml(normalizedRequest.vehicle.brand)}</li>
          <li><strong>Modèle :</strong> ${escapeHtml(normalizedRequest.vehicle.model)}</li>
          <li><strong>Année :</strong> ${escapeHtml(normalizedRequest.vehicle.year)}</li>
          <li><strong>Énergie :</strong> ${escapeHtml(normalizedRequest.vehicle.energy)}</li>
          <li><strong>Kilométrage :</strong> ${escapeHtml(normalizedRequest.vehicle.mileage)}</li>
        </ul>

        <h3>Prestations</h3>
        <ul>${servicesHtml}</ul>

        <h3>Panier</h3>
        <p><strong>${escapeHtml(String(normalizedRequest.selectedBasket || "standard").toUpperCase())}</strong></p>

        <h3>Contrôle préalable</h3>
        <ul>
          <li><strong>Contrôle ajouté :</strong> ${normalizedRequest.j7Accepted ? "Oui" : "Non"}</li>
          <li><strong>Contrôle refusé :</strong> ${normalizedRequest.refuseControl ? "Oui" : "Non"}</li>
        </ul>

        <h3>Estimation</h3>
        <ul>
          <li><strong>Main d’œuvre estimée :</strong> ${escapeHtml(euro(normalizedRequest.totals.laborBase))}</li>
          <li><strong>Remise combo :</strong> ${escapeHtml(euro(normalizedRequest.totals.comboSaving))}</li>
          <li><strong>Contrôle préalable :</strong> ${escapeHtml(euro(normalizedRequest.totals.j7Saving))}</li>
          <li><strong>Pièces estimées :</strong> ${escapeHtml(euro(normalizedRequest.totals.partsMin))} à ${escapeHtml(euro(normalizedRequest.totals.partsMax))}</li>
          <li><strong>Total estimé tout compris :</strong> ${escapeHtml(totalRange)}</li>
        </ul>

        <h3>Notes client</h3>
        <p>${escapeHtml(normalizedRequest.notes || "Aucune note")}</p>

        <hr>
        <p style="font-size:12px;color:#6b7280">Demande reçue le ${escapeHtml(normalizedRequest.createdAt)}</p>
      </div>
    `;

    const text = [
      "Nouvelle demande EDM AUTO",
      "",
      "CLIENT",
      `Nom : ${normalizedRequest.client.lastName}`,
      `Prénom : ${normalizedRequest.client.firstName}`,
      `Téléphone : ${normalizedRequest.client.phone}`,
      `Email : ${normalizedRequest.client.email}`,
      "",
      "VÉHICULE",
      `Plaque : ${normalizedRequest.vehicle.plate}`,
      `Marque : ${normalizedRequest.vehicle.brand}`,
      `Modèle : ${normalizedRequest.vehicle.model}`,
      `Année : ${normalizedRequest.vehicle.year}`,
      `Énergie : ${normalizedRequest.vehicle.energy}`,
      `Kilométrage : ${normalizedRequest.vehicle.mileage}`,
      "",
      "PRESTATIONS",
      servicesText,
      "",
      `PANIER : ${String(normalizedRequest.selectedBasket || "standard").toUpperCase()}`,
      "",
      "CONTRÔLE PRÉALABLE",
      `Contrôle ajouté : ${normalizedRequest.j7Accepted ? "Oui" : "Non"}`,
      `Contrôle refusé : ${normalizedRequest.refuseControl ? "Oui" : "Non"}`,
      "",
      "ESTIMATION",
      `Main d’œuvre estimée : ${euro(normalizedRequest.totals.laborBase)}`,
      `Remise combo : ${euro(normalizedRequest.totals.comboSaving)}`,
      `Contrôle préalable : ${euro(normalizedRequest.totals.j7Saving)}`,
      `Pièces estimées : ${euro(normalizedRequest.totals.partsMin)} à ${euro(normalizedRequest.totals.partsMax)}`,
      `Total estimé tout compris : ${totalRange}`,
      "",
      "NOTES CLIENT",
      normalizedRequest.notes || "Aucune note",
      "",
      `Reçue le : ${normalizedRequest.createdAt}`,
    ].join("\n");

    const resendResult = await sendWithResend({
      apiKey: resendApiKey,
      fromEmail: resendFromEmail,
      toEmail: resendToEmail,
      replyTo: normalizedRequest.client.email,
      subject,
      html,
      text,
    });

    return res.status(200).json({
      success: true,
      message: "Demande envoyée à EDM AUTO.",
      emailProvider: "resend",
      resendResult,
      sent: {
        client: normalizedRequest.client,
        vehicle: normalizedRequest.vehicle,
        basket: normalizedRequest.selectedBasket,
        servicesCount: normalizedRequest.services.length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Erreur serveur dans api/submit-request.js",
      details: error.message || String(error),
    });
  }
}
