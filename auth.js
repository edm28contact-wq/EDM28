const SUPABASE_URL = "https://ojjbnwpkfvzjfukgqddz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_pB4h3KASp9MHM6upvCAcCA_b_9vKHiX";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function ensureAuthStatusNode() {
  let node = document.getElementById("authStatus");
  if (node) return node;
  const card = document.getElementById("clientCard");
  if (!card) return null;
  node = document.createElement("div");
  node.id = "authStatus";
  node.className = "small";
  node.style.marginTop = "10px";
  const row = card.querySelector(".btn-row");
  if (row) row.insertAdjacentElement("afterend", node);
  return node;
}

function setAuthStatus(message, isError = false) {
  const box = ensureAuthStatusNode();
  if (!box || typeof escapeHtml !== "function") return;
  box.innerHTML = `<span style="color:${isError ? "var(--red)" : "var(--green)"};font-weight:900">${escapeHtml(message)}</span>`;
}

async function hydrateUserFromSupabase(user) {
  if (!user) return;

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  state.user = {
    id: user.id,
    firstName: profile?.first_name || user.user_metadata?.first_name || "",
    lastName: profile?.last_name || user.user_metadata?.last_name || "",
    phone: profile?.phone || user.user_metadata?.phone || "",
    email: user.email || ""
  };

  const ids = ["firstName", "lastName", "phone", "email"];
  ids.forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;
    if (id === "firstName") input.value = state.user.firstName || "";
    if (id === "lastName") input.value = state.user.lastName || "";
    if (id === "phone") input.value = state.user.phone || "";
    if (id === "email") input.value = state.user.email || "";
  });

  if (typeof saveState === "function") saveState();
  if (typeof updateAccountUi === "function") updateAccountUi();
}

async function signOutFromSupabase() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    setAuthStatus(error.message, true);
    return;
  }
  state.user = null;
  if (typeof saveState === "function") saveState();
  if (typeof updateAccountUi === "function") updateAccountUi();
  setAuthStatus("Déconnecté.");
}

async function saveAccount(showToast = true) {
  const client = typeof getClient === "function" ? getClient() : null;
  if (!client?.firstName || !client?.lastName || !client?.phone || !client?.email) {
    setAuthStatus("Complète prénom, nom, téléphone et email.", true);
    return false;
  }

  const raw = window.prompt("Entre un mot de passe (min. 6 caractères). Si le compte existe déjà, ce mot de passe servira à te connecter.");
  const password = (raw || "").trim();

  if (!password || password.length < 6) {
    setAuthStatus("Mot de passe minimum 6 caractères.", true);
    return false;
  }

  const signIn = await supabaseClient.auth.signInWithPassword({
    email: client.email,
    password
  });

  if (!signIn.error && signIn.data?.user) {
    await hydrateUserFromSupabase(signIn.data.user);
    setAuthStatus("Connexion réussie.");
    if (showToast && typeof toast === "function") toast("Connexion réussie.");
    return true;
  }

  const signUp = await supabaseClient.auth.signUp({
    email: client.email,
    password,
    options: {
      data: {
        first_name: client.firstName,
        last_name: client.lastName,
        phone: client.phone
      }
    }
  });

  if (signUp.error) {
    setAuthStatus(signUp.error.message, true);
    return false;
  }

  if (signUp.data?.user) {
    state.user = { ...client, id: signUp.data.user.id };
    if (typeof saveState === "function") saveState();
    setAuthStatus("Compte créé. Vérifie ton email si une confirmation est demandée.");
    if (showToast && typeof toast === "function") toast("Compte créé.");
    return true;
  }

  setAuthStatus("Compte en attente de confirmation.");
  return true;
}

async function bootstrapSupabaseAuth() {
  ensureAuthStatusNode();

  const btnGuest = document.getElementById("btnGuest");
  if (btnGuest) {
    btnGuest.textContent = "Se déconnecter";
    btnGuest.addEventListener("click", signOutFromSupabase);
  }

  const btnSave = document.getElementById("btnSaveAccount");
  if (btnSave) {
    btnSave.textContent = "Créer / connecter mon compte";
  }

  const { data } = await supabaseClient.auth.getSession();
  if (data?.session?.user) {
    await hydrateUserFromSupabase(data.session.user);
    setAuthStatus("Session active.");
  }

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      await hydrateUserFromSupabase(session.user);
    } else {
      state.user = null;
      if (typeof saveState === "function") saveState();
      if (typeof updateAccountUi === "function") updateAccountUi();
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  bootstrapSupabaseAuth();
});
