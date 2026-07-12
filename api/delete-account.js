const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(res, status, body) {
  res.status(status).json(body);
}

async function getAuthenticatedUser(token) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return null;
  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    res.setHeader("Allow", "POST, DELETE");
    return json(res, 405, { success: false, error: "Méthode non autorisée." });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(res, 503, {
      success: false,
      configured: false,
      error: "La suppression de compte n'est pas configurée.",
    });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return json(res, 401, { success: false, error: "Authentification requise." });
  }

  try {
    const user = await getAuthenticatedUser(token);
    if (!user?.id) {
      return json(res, 401, { success: false, error: "Session invalide ou expirée." });
    }

    const deleteResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (!deleteResponse.ok) {
      const details = await deleteResponse.text();
      console.error("Supabase account deletion failed", deleteResponse.status, details);
      return json(res, 502, { success: false, error: "La suppression du compte a échoué." });
    }

    return json(res, 200, { success: true });
  } catch (error) {
    console.error("delete-account error", error);
    return json(res, 500, { success: false, error: "Erreur serveur lors de la suppression du compte." });
  }
}
