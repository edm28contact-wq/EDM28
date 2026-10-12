(() => {
  const form = document.getElementById('edmFaqAiForm');
  const input = document.getElementById('edmFaqAiQuestion');
  const submit = document.getElementById('edmFaqAiSubmit');
  const messages = document.getElementById('edmFaqAiMessages');
  const choices = document.getElementById('edmFaqAiChoices');
  const reset = document.getElementById('edmFaqAiReset');
  const status = document.getElementById('edmFaqAiStatus');
  if (!form || !input || !submit || !messages || !choices || !reset || !status) return;

  let previousQuestion = '';
  let busy = false;
  let generation = 0;
  let controller = null;

  const BUTTONS = Object.freeze({
    side: [['Avant (AV)', 'avant'], ['Arrière (AR)', 'arriere'], ['Les deux (AV + AR)', 'avant arriere']],
    vehicle: [['Citadine', 'citadine'], ['Compacte / Berline', 'compacte'], ['SUV / grand véhicule', 'suv'], ['Sportif / utilitaire', 'sportif']],
    service_brakes: [['Plaquettes seules', 'plaquettes'], ['Disques + plaquettes', 'disques et plaquettes']],
    service_links: [['Direction', 'biellettes de direction'], ['Barre stabilisatrice', 'biellettes de barre stabilisatrice']]
  });

  const setStatus = (value, error = false) => {
    status.textContent = value;
    status.classList.toggle('faq-ai-error', error);
  };

  const addMessage = (text, fromUser) => {
    const item = document.createElement('div');
    item.className = 'faq-chat-message ' + (fromUser ? 'faq-chat-user' : 'faq-chat-assistant');
    const label = document.createElement('span');
    label.className = 'faq-chat-label';
    label.textContent = fromUser ? 'Vous' : 'Assistant EDM28';
    const body = document.createElement('p');
    body.textContent = String(text);
    item.append(label, body);
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
  };

  const clearChoices = () => {
    choices.replaceChildren();
    choices.hidden = true;
  };

  const setBusy = (value) => {
    busy = value;
    input.disabled = value;
    submit.disabled = value;
    choices.querySelectorAll('button').forEach((button) => { button.disabled = value; });
    form.setAttribute('aria-busy', String(value));
  };

  const ask = async (rawValue, displayValue = rawValue) => {
    const value = String(rawValue || '').trim();
    if (busy || !value) return;
    if (value.length < 3) {
      setStatus('Écrivez une question plus précise.', true);
      input.focus();
      return;
    }

    const context = previousQuestion;
    addMessage(displayValue, true);
    clearChoices();
    input.value = '';
    setBusy(true);
    setStatus('L’assistant prépare sa réponse…');
    const requestGeneration = generation;
    controller = new AbortController();

    try {
      const response = await fetch('/api/faq-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({ question: value, previousQuestion: context })
      });
      const data = await response.json().catch(() => null);
      if (requestGeneration !== generation) return;
      if (!response.ok || typeof data?.answer !== 'string' || !data.answer.trim()) {
        const diagnostic = String(data?.diagnostic || '').trim();
        throw new Error((data?.error || 'Réponse indisponible.') + (diagnostic ? ' (' + diagnostic + ')' : ''));
      }
      addMessage(data.answer, false);
      previousQuestion = data.followUp ? [context, value].filter(Boolean).join(' ').slice(0, 500) : '';
      const items = BUTTONS[data.followUp] || [];
      if (items.length) {
        choices.hidden = false;
        for (const [label, answer] of items) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'faq-ai-choice';
          button.textContent = label;
          button.addEventListener('click', () => ask(answer, label));
          choices.appendChild(button);
        }
      }
      setStatus('');
    } catch (error) {
      if (requestGeneration !== generation) return;
      previousQuestion = '';
      addMessage(error?.name === 'AbortError' ? 'La demande a été interrompue.' : error?.message || 'L’assistant est momentanément indisponible.', false);
      setStatus('Vous pouvez réessayer.', true);
    } finally {
      if (requestGeneration === generation) {
        controller = null;
        setBusy(false);
        input.focus();
      }
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    ask(input.value);
  });

  reset.addEventListener('click', () => {
    generation += 1;
    controller?.abort();
    controller = null;
    previousQuestion = '';
    clearChoices();
    messages.replaceChildren();
    addMessage('Bonjour, quelle est votre question ? Je peux vous renseigner sur les prestations et leurs tarifs indicatifs.', false);
    input.value = '';
    setBusy(false);
    setStatus('');
    input.focus();
  });
})();
