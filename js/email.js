// =============================================
// EMAIL.JS — envio de email (EmailJS ou servidor PHP)
// Carregado em index.html e inscricao.html
// Configurado no painel admin → Configurações → Email
// =============================================

(function() {
  'use strict';

  function getCfg() {
    try { return JSON.parse(localStorage.getItem('email_config') || '{}'); } catch { return {}; }
  }

  // ---- Envio via servidor PHP (mail.php) ------------------
  async function sendViaServer(cfg, tipo, params) {
    const res = await fetch(cfg.serverUrl, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'X-Secret-Token':  cfg.serverToken || '',
      },
      body: JSON.stringify({ _tipo: tipo, _token: cfg.serverToken || '', ...params }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Servidor devolveu erro');
    return true;
  }

  // ---- Envio via EmailJS ----------------------------------
  function loadSDK(publicKey) {
    return new Promise((resolve, reject) => {
      if (window.emailjs) {
        try { window.emailjs.init({ publicKey }); } catch(_) {}
        resolve(); return;
      }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
      s.onload = () => {
        try { window.emailjs.init({ publicKey }); resolve(); }
        catch(e) { reject(e); }
      };
      s.onerror = () => reject(new Error('Falha ao carregar EmailJS'));
      document.head.appendChild(s);
    });
  }

  async function sendViaEmailJS(cfg, templateKey, params) {
    const templateId = cfg[templateKey];
    if (!templateId) return false;
    await loadSDK(cfg.publicKey);
    await window.emailjs.send(cfg.serviceId, templateId, {
      ...params,
      to_email: cfg.dest || params.email || '',
    });
    return true;
  }

  // ---- API pública ----------------------------------------

  /**
   * sendEmail(templateKey, params)
   *   templateKey: 'tplContacto' | 'tplInscricao'
   *   params: objecto com os campos do formulário
   *   returns: Promise<boolean> — true se enviado
   */
  window.sendEmail = async function(templateKey, params) {
    const cfg = getCfg();
    try {
      if (cfg.mode === 'server' && cfg.serverUrl) {
        const tipo = templateKey === 'tplInscricao' ? 'inscricao' : 'contacto';
        return await sendViaServer(cfg, tipo, params);
      }
      if (cfg.publicKey && cfg.serviceId) {
        return await sendViaEmailJS(cfg, templateKey, params);
      }
    } catch(err) {
      console.warn('[email.js]', err?.message || err);
    }
    return false;
  };

  window.emailConfigured = function() {
    const cfg = getCfg();
    return (cfg.mode === 'server' && !!cfg.serverUrl)
        || (!cfg.mode && !!cfg.publicKey && !!cfg.serviceId);
  };

  // Expor loadEmailJS para o admin usar no botão de teste
  window.loadEmailJS = loadSDK;
})();
