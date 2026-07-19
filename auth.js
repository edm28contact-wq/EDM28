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

  ["firstName", "lastName", "phone", "email"].forEach((id) => {
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

async function bootstrapSupabaseAuth() {
  ensureAuthStatusNode();

  const password = document.getElementById("password");
  password?.closest("label")?.remove();

  const legacyButtons = ["btnSignUp", "btnSignIn", "btnSaveAccount", "btnGuest"];
  legacyButtons.forEach((id) => document.getElementById(id)?.remove());

  const { data } = await supabaseClient.auth.getSession();
  if (data?.session?.user) {
    await hydrateUserFromSupabase(data.session.user);
    setAuthStatus("Session active.");
  } else {
    setAuthStatus("Connexion sécurisée par code email.");
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
