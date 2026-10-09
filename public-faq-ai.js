(() => {
  const form = document.getElementById('edmFaqAiForm');
  const question = document.getElementById('edmFaqAiQuestion');
  const button = document.getElementById('edmFaqAiSubmit');
  const status = document.getElementById('edmFaqAiStatus');
  const answer = document.getElementById('edmFaqAiAnswer');
  if (!form || !question || !button || !status || !answer) return;

  const setStatus = (message, error = false) => {
    status.textContent = message || '';
    status.classList.toggle('faq-ai-error', Boolean(error));
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = String(question.value || '').trim();
    if (value.length < 3) {
      setStatus('Écrivez une question plus précise.', true);
      question.focus();
      return;
    }

    button.disabled = true;
    question.disabled = true;
    answer.hidden = true;
    answer.textContent = '';
    setStatus('Recherche dans la FAQ EDM28…');

    try {
      const response = await fetch('/api/faq-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ question: value })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.answer) {
        const code = String(data?.diagnostic || '').trim();
        const message = data?.error || 'Réponse indisponible.';
        throw new Error(code ? `${message} (${code})` : message);
      }
      answer.textContent = data.answer;
      answer.hidden = false;
      setStatus('');
    } catch (error) {
      setStatus(error?.message || 'L’assistant est momentanément indisponible.', true);
    } finally {
      button.disabled = false;
      question.disabled = false;
    }
  });
})();
