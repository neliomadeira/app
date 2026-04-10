// =============================================
// EMAIL.JS — envio via EmailJS (opcional)
// Carregado em index.html e inscricao.html
// Funciona apenas se email_config estiver
// configurado no painel admin.
// =============================================

(function() {
  'use strict';

  function getEmailCfg() {
    try { return JSON.parse(localStorage.getItem('email_config') || '{}'); } catch { return {}; }
  }

  function isConfigured(cfg) {
    return !!(cfg.publicKey && cfg.serviceId);
  }

  // Carrega o SDK do EmailJS dinamicamente (apenas uma vez)
  function loadSDK(publicKey) {
    return new Promise((resolve, reject) => {
      if (window.emailjs) {
        try { window.emailjs.init({ publicKey }); } catch(_) {}
        resolve();
        return;
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

  // Envia um email; retorna Promise<boolean> (true = enviado, false = ignorado/não conf.)
  window.sendEmail = async function(templateKey, params) {
    const cfg = getEmailCfg();
    if (!isConfigured(cfg)) return false;

    const templateId = cfg[templateKey];
    if (!templateId) return false;

    try {
      await loadSDK(cfg.publicKey);
      await window.emailjs.send(cfg.serviceId, templateId, {
        ...params,
        to_email: cfg.dest || params.email || '',
      });
      return true;
    } catch(err) {
      console.warn('[EmailJS]', err?.text || err?.message || err);
      return false;
    }
  };

  window.emailConfigured = function() {
    return isConfigured(getEmailCfg());
  };
})();
