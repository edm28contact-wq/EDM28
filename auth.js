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
  card.querySelector(".btn-row")?.insertAdjacentElement("afterend", node);
  return node;
}

function setAuthStatus(message, isError = false) {
  const box = ensureAuthStatusNode();
  if (!box || typeof escapeHtml !== "function") return;
  box.innerHTML = `<span style="color:${isError ? "var(--red)" : "var(--green)"};font-weight:900">${escapeHtml(message)}</span>`;
}

function fieldValue(id) {
  return document.getElementById(id)?.value?.trim() || "";
}

async function hydrateUserFromSupabase(user) {
  if (!user) return;
  const entered = {
    firstName: fieldValue("firstName"),
    lastName: fieldValue("lastName"),
    phone: fieldValue("phone"),
    email: fieldValue("email")
  };
  const { data: profile } = await supabaseClient.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const previous = typeof state !== "undefined" ? state.user || {} : {};
  const firstName = profile?.first_name || user.user_metadata?.first_name || entered.firstName || previous.firstName || "";
  const lastName = profile?.last_name || user.user_metadata?.last_name || entered.lastName || previous.lastName || "";
  const phone = profile?.phone || user.user_metadata?.phone || entered.phone || previous.phone || "";
  const email = user.email || entered.email || previous.email || "";

  state.user = { id: user.id, firstName, lastName, phone, email };
  const values = { firstName, lastName, phone, email };
  Object.entries(values).forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.value = value;
    input.readOnly = id === "email";
  });
  const incomplete = !firstName || !lastName || !phone;
  ["firstName", "lastName", "phone"].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.readOnly = !incomplete;
  });
  if (typeof saveState === "function") saveState();
  if (typeof updateAccountUi === "function") updateAccountUi();
  if (incomplete) {
    ["firstName", "lastName", "phone"].forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.readOnly = false;
    });
    setAuthStatus("Session active. Complétez vos coordonnées avant l’envoi.", true);
  }
}

async function signOutFromSupabase() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) return setAuthStatus(error.message, true);
  state.user = null;
  if (typeof saveState === "function") saveState();
  if (typeof updateAccountUi === "function") updateAccountUi();
  setAuthStatus("Déconnecté.");
}

async function bootstrapSupabaseAuth() {
  ensureAuthStatusNode();
  document.getElementById("password")?.closest("label")?.remove();
  ["btnSignUp", "btnSignIn", "btnSaveAccount", "btnGuest"].forEach((id) => document.getElementById(id)?.remove());
  const { data } = await supabaseClient.auth.getSession();
  if (data?.session?.user) await hydrateUserFromSupabase(data.session.user);
  else setAuthStatus("Connexion sécurisée par code email.");
  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) await hydrateUserFromSupabase(session.user);
    else {
      state.user = null;
      if (typeof saveState === "function") saveState();
      if (typeof updateAccountUi === "function") updateAccountUi();
    }
  });
}

window.addEventListener("DOMContentLoaded", bootstrapSupabaseAuth);