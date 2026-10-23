(() => {
  'use strict';
  const config = window.ArchivioConfig;
  const page = document.querySelector('[data-story-page]');
  async function rpc(name, args = {}) {
    const response = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(args), cache: 'no-store', signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error('Servizio non disponibile');
    return response.json();
  }
  function mark(slug, unlocked) {
    document.querySelectorAll('[data-story-link]').forEach(link => {
      if (link.dataset.storyLink !== slug) return;
      link.dataset.unlocked = String(unlocked);
      const badge = link.querySelector('.story-badge');
      if (badge) badge.textContent = unlocked ? 'Storia ritrovata' : 'Da ritrovare';
    });
  }
  async function refreshList() {
    try {
      const list = await rpc('archivio_elenco');
      if (Array.isArray(list)) list.forEach(item => mark(item.slug, item.unlocked === true));
    } catch (_) { /* Never show a failed lookup as an unlocked story. */ }
  }
  document.querySelectorAll('.person-card-link, .characters-list a').forEach(link => {
    const match = new URL(link.href).pathname.match(/\/personaggi\/([^/]+)\//);
    if (!match) return;
    const publicStory = match[1] === 'teresa';
    if (!publicStory) link.dataset.storyLink = match[1];
    const badge = document.createElement('span');
    badge.className = 'story-badge';
    badge.textContent = publicStory ? 'Storia ritrovata' : 'Verifica disponibilità';
    link.appendChild(badge);
    if (link.closest('.teresa-portrait')) {
      const caption = link.querySelector('figcaption');
      if (caption) {
        const group = document.createElement('div');
        group.className = 'teresa-caption';
        group.append(caption, badge);
        link.appendChild(group);
      }
    }
  });
  refreshList();
  if (!page) return;
  const slug = page.dataset.storyPage;
  const status = page.querySelector('.story-status');
  const gate = page.querySelector('.story-gate');
  const story = page.querySelector('.character-story');
  const form = page.querySelector('form');
  const message = page.querySelector('.unlock-message');
  const retry = page.querySelector('.story-retry');
  const submit = form.querySelector('button');
  let pending = false;
  function reveal(data) {
    // The backend contains only escaped source text plus paragraph/br tags.
    const doc = new DOMParser().parseFromString(data.html, 'text/html');
    const safe = document.createDocumentFragment();
    function copy(node, parent) {
      if (node.nodeType === Node.TEXT_NODE) { parent.appendChild(document.createTextNode(node.textContent)); return; }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const element = ['P', 'BR'].includes(node.tagName) ? document.createElement(node.tagName.toLowerCase()) : parent;
      if (element !== parent) parent.appendChild(element);
      node.childNodes.forEach(child => copy(child, element));
    }
    doc.body.childNodes.forEach(node => copy(node, safe));
    const narrators = {
      'giardiniere': 'Il giardiniere',
      'sarta': 'La sarta',
      'figlio-del-medico': 'Il figlio del medico',
      'ferroviere': 'Il ferroviere',
      'bambinaia-cecilia': 'La bambinaia di Cecilia',
      'teresa': 'Elisa, nipote di Teresa'
    };
    if (narrators[slug]) {
      const signature = document.createElement('p');
      signature.className = 'story-signature';
      signature.textContent = narrators[slug];
      safe.appendChild(signature);
    }
    story.replaceChildren(safe); story.hidden = false; gate.hidden = true; retry.hidden = true;
    status.textContent = 'Storia ritrovata · Ora è leggibile da tutti.';
    mark(slug, true);
  }
  async function load() {
    if (pending || !story.hidden) return;
    retry.hidden = true;
    try {
      const data = await rpc('archivio_leggi', { p_slug: slug });
      if (!data.found) throw new Error('Storia non disponibile');
      if (data.unlocked && typeof data.html === 'string') reveal(data);
      else { gate.hidden = false; status.textContent = 'Questa storia attende di essere ritrovata.'; mark(slug, false); }
    } catch (_) {
      if (gate.hidden) status.textContent = 'Non riesco a verificare la storia. Controlla la connessione e riprova.';
      retry.hidden = false;
    }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (pending) return;
    pending = true; submit.disabled = true; message.textContent = 'Verifico il codice…';
    try {
      const data = await rpc('archivio_sblocca', { p_slug: slug, p_codice: form.elements.codice.value.trim() });
      if (data.ok && typeof data.html === 'string') { const codice = form.elements.codice.value.trim(); reveal(data); page.dispatchEvent(new CustomEvent('archivio:codice-verificato', { detail: { codice } })); form.reset(); }
      else message.textContent = 'Il codice non corrisponde a questa fotografia. Controllalo e riprova.';
    } catch (_) { message.textContent = 'Il collegamento non è riuscito. Riprova tra poco.'; }
    finally { pending = false; submit.disabled = false; }
  });
  retry.addEventListener('click', load);
  load();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { load(); refreshList(); } });
  setInterval(() => { if (!document.hidden) { load(); refreshList(); } }, 30000);
})();
