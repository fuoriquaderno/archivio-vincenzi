(() => {
  'use strict';
  const page = document.querySelector('[data-story-page]');
  if (!page) return;
  const section = page.querySelector('.story-comments');
  if (!section) return;
  const slug = page.dataset.storyPage;
  const codeForm = section.querySelector('.comment-code-form');
  const commentForm = section.querySelector('.finder-comment-form');
  const message = section.querySelector('.comment-message');
  const approved = section.querySelector('.approved-comments');
  const normalize = value => value.toUpperCase().replace(/[\s-]/g, '');
  let verifiedCode = '';
  let busy = false;
  let hasSent = false;
  async function rpc(name,args) {
    const config = window.ArchivioConfig;
    const response = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
      method:'POST', headers:{apikey:config.publishableKey,'Content-Type':'application/json'},
      body:JSON.stringify(args), cache:'no-store', signal:AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error('Servizio non disponibile');
    return response.json();
  }
  function sent(text) {
    hasSent = true; verifiedCode = '';
    codeForm.hidden = true; commentForm.hidden = true;
    codeForm.reset(); commentForm.reset();
    message.textContent = text;
  }
  async function verify(raw) {
    if (busy || hasSent) return;
    const code = normalize(raw);
    if (!/^[A-Z0-9]{16}$/.test(code)) {
      message.textContent = 'Controlla il codice stampato sul retro della fotografia.';
      return;
    }
    busy = true; codeForm.querySelector('button').disabled = true;
    message.textContent = 'Verifico il codice…';
    try {
      const result = await rpc('archivio_commento_stato',{p_slug:slug,p_codice:code});
      if (result.ok !== true) {
        verifiedCode = ''; commentForm.hidden = true; codeForm.hidden = false;
        message.textContent = 'Il codice non corrisponde a questa fotografia.';
      } else if (result.gia_inviato === true) {
        sent('Per questa fotografia è già stato inviato un commento. Ogni codice permette un solo invio.');
      } else {
        verifiedCode = code; codeForm.reset(); codeForm.hidden = true; commentForm.hidden = false;
        message.textContent = 'Codice verificato. Se preferisci, puoi tornare più avanti e inserirlo di nuovo per lasciare il commento.';
      }
    } catch (_) {
      codeForm.hidden = false;
      message.textContent = 'Non riesco a verificare il codice. Riprova tra poco.';
    } finally { busy = false; codeForm.querySelector('button').disabled = false; }
  }
  async function readApproved() {
    try {
      const comments = await rpc('archivio_commenti_leggi',{p_slug:slug});
      approved.replaceChildren();
      if (Array.isArray(comments)) comments.forEach(item => {
        if (typeof item.testo !== 'string') return;
        const text = document.createElement('p');
        text.className = 'finder-testimony';
        text.textContent = item.testo;
        approved.append(text);
      });
      approved.hidden = !approved.childElementCount;
    } catch (_) { /* Never expose unapproved comments or claim a lookup succeeded. */ }
  }
  let revealed = false;
  function show() {
    if (revealed) return;
    revealed = true; section.hidden = false; readApproved();
    try {
      const handoff = sessionStorage.getItem('archivio-commento:' + slug);
      sessionStorage.removeItem('archivio-commento:' + slug);
      if (handoff) verify(handoff);
    } catch (_) { /* The printed code remains usable if browser storage is disabled. */ }
  }
  const story = page.querySelector('.character-story');
  if (story && !story.hidden) show();
  const observer = new MutationObserver(() => { if (story && !story.hidden) show(); });
  if (story) observer.observe(story,{attributes:true,attributeFilter:['hidden']});
  page.addEventListener('archivio:codice-verificato',event => { show(); verify(event.detail.codice); });
  codeForm.addEventListener('submit',event => { event.preventDefault(); verify(codeForm.elements.codice.value); });
  commentForm.addEventListener('submit',async event => {
    event.preventDefault();
    if (busy || hasSent || !verifiedCode) return;
    const text = commentForm.elements.commento.value.trim();
    if (!text || text.length > 2000) { message.textContent = 'Scrivi un commento di massimo 2000 caratteri.'; return; }
    busy = true; commentForm.querySelector('button').disabled = true;
    message.textContent = 'Invio il commento…';
    try {
      const result = await rpc('archivio_commento_invia',{p_slug:slug,p_codice:verifiedCode,p_commento:text});
      if (result.ok === true) sent('Grazie! Il commento è stato ricevuto. Sarà pubblicato dopo l’approvazione di chi cura l’archivio.');
      else if (result.errore === 'gia_inviato') sent('Per questa fotografia è già stato inviato un commento. Ogni codice permette un solo invio.');
      else message.textContent = result.errore === 'testo' ? 'Scrivi un commento di massimo 2000 caratteri.' : 'Il codice non è valido. Ricarica la pagina e inseriscilo di nuovo.';
    } catch (_) {
      message.textContent = 'Non ho ricevuto conferma dell’invio. Riprova: il codice non può creare commenti duplicati.';
    } finally { busy = false; commentForm.querySelector('button').disabled = false; }
  });
})();
