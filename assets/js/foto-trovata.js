(() => {
  'use strict';
  function init() {
    const section = document.querySelector('.found-photo');
    if (!section) return;
    const form = section.querySelector('form');
    const story = section.querySelector('select');
    const code = section.querySelector('input');
    const button = section.querySelector('button');
    const message = section.querySelector('[role="status"]');
    const allowed = new Set(Array.from(story.options, option => option.value).filter(Boolean));
    const normalize = value => value.toUpperCase().replace(/[\s-]/g, '');
    const params = new URLSearchParams(location.hash.slice(1));
    const selected = params.get('storia');
    const scannedCode = normalize(params.get('codice') || '');
    if (allowed.has(selected) && /^[A-Z0-9]{16}$/.test(scannedCode)) {
      story.value = selected;
      code.value = scannedCode.match(/.{4}/g).join('-');
      message.textContent = 'Il codice della tua foto è già inserito. Premi «Scopri la storia».';
      history.replaceState(null, '', location.pathname + location.search);
    }
    let pending = false;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (pending) return;
      const slug = story.value;
      const enteredCode = normalize(code.value);
      if (!allowed.has(slug) || !/^[A-Z0-9]{16}$/.test(enteredCode)) {
        message.textContent = 'Scegli la storia e controlla il codice stampato sul retro.';
        return;
      }
      pending = true;
      button.disabled = true;
      message.textContent = 'Verifico il codice della tua fotografia…';
      try {
        const config = window.ArchivioConfig;
        const response = await fetch(`${config.url}/rest/v1/rpc/archivio_sblocca`, {
          method: 'POST',
          headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_slug: slug, p_codice: enteredCode }),
          cache: 'no-store', signal: AbortSignal.timeout(12000)
        });
        if (!response.ok) throw new Error('Servizio non disponibile');
        const result = await response.json();
        if (result.ok !== true) {
          message.textContent = 'Il codice non corrisponde a questa storia. Controlla il numero e il codice sul retro della foto.';
          return;
        }
        try { sessionStorage.setItem('archivio-commento:' + slug, enteredCode); } catch (_) {}
        location.assign(section.dataset.storiesBase + encodeURIComponent(slug) + '/');
      } catch (_) {
        message.textContent = 'Non riesco a verificare il codice. Controlla la connessione e riprova.';
      } finally {
        pending = false;
        button.disabled = false;
      }
    });
  }
  if (document.readyState === 'complete') init();
  else document.addEventListener('DOMContentLoaded', init, { once: true });
})();
