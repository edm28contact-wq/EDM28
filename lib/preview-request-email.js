export async function sendPreviewRequestEmailFallback({ supabaseUrl, anonKey, authorization, requestId }) {
  if (!supabaseUrl || !anonKey || !authorization || !requestId) {
    return { ok: false, error: 'Configuration fallback Preview incomplete.' };
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/preview_send_request_notification`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      apikey: anonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_request_id: requestId })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: result?.message || result?.error || 'Fallback email Preview indisponible.'
    };
  }

  return {
    ok: result?.success === true,
    status: result?.status || response.status,
    id: result?.id || null,
    error: result?.error || null
  };
}
