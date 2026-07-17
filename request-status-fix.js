(() => {
  const install = () => {
    if (typeof supabaseClient === 'undefined' || supabaseClient.__edmRequestStatusFix) return;

    const originalFrom = supabaseClient.from.bind(supabaseClient);
    supabaseClient.from = (table) => {
      const builder = originalFrom(table);
      if (table !== 'service_requests' || typeof builder.insert !== 'function') return builder;

      const originalInsert = builder.insert.bind(builder);
      builder.insert = (values, options) => {
        const rows = Array.isArray(values) ? values : [values];
        const patched = rows.map((row) => ({ ...row, status: 'draft', submitted_at: null }));
        return originalInsert(Array.isArray(values) ? patched : patched[0], options);
      };
      return builder;
    };

    supabaseClient.__edmRequestStatusFix = true;
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();