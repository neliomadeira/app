// =============================================
// INSCRIÇÃO PAGE — JS (Portugal)
// =============================================

document.addEventListener('DOMContentLoaded', () => {

  // ---- MODALIDADE PICKER ---- //
  const isFutebol = () => {
    const sel = document.querySelector('input[name="modalidade"]:checked');
    return !sel || sel.value === 'Futebol' || sel.value === 'Futsal';
  };

  function applyModalidade() {
    const futebol = isFutebol();
    const grpFutebol  = document.getElementById('grpFutebol');
    const grpCategoria= document.getElementById('grpCategoria');
    const grpNivel    = document.getElementById('grpNivel');
    const catSelect   = document.getElementById('categoria');
    const heroDesc    = document.querySelector('.page-hero__desc');
    const sidebarInfo = document.querySelector('.insc-info-card');

    if (grpFutebol)   grpFutebol.style.display   = futebol ? '' : 'none';
    if (grpCategoria) grpCategoria.style.display  = futebol ? '' : 'none';
    if (grpNivel)     grpNivel.style.display      = futebol ? 'none' : '';
    if (catSelect)    catSelect.required           = futebol;

    // Update sidebar first card title
    if (sidebarInfo) {
      const title = sidebarInfo.querySelector('.insc-info-card__title');
      const modVal = document.querySelector('input[name="modalidade"]:checked')?.value || 'Futebol';
      if (title) {
        title.textContent = (modVal === 'Futebol' || modVal === 'Futsal')
          ? 'Escalões disponíveis'
          : `${modVal} — Níveis`;
      }
    }
  }

  document.querySelectorAll('input[name="modalidade"]').forEach(radio => {
    radio.addEventListener('change', () => {
      // Update visual active state
      document.querySelectorAll('.modality-pick').forEach(l => l.classList.remove('modality-pick--active'));
      radio.closest('.modality-pick')?.classList.add('modality-pick--active');
      applyModalidade();
    });
  });

  applyModalidade(); // init

  // ---- NIF MASK ---- //
  const nif = document.getElementById('nifAtleta');
  nif?.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 9);
    v = v.replace(/(\d{3})(\d{3})(\d{0,3})/, (_, a, b, c) =>
      c ? `${a} ${b} ${c}` : b ? `${a} ${b}` : a
    );
    e.target.value = v;
  });

  // ---- CÓDIGO POSTAL MASK (XXXX-XXX) ---- //
  const cp = document.getElementById('codigoPostal');
  cp?.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 7);
    if (v.length > 4) v = v.slice(0, 4) + '-' + v.slice(4);
    e.target.value = v;
  });

  // ---- PHONE (Portugal) ---- //
  const tel = document.getElementById('telefoneResp');
  tel?.addEventListener('input', (e) => {
    let v = e.target.value.replace(/[^\d+]/g, '');
    if (!v.startsWith('+') && !v.startsWith('00')) {
      v = v.replace(/^(\d{3})(\d{3})(\d{0,3})/, (_, a, b, c) =>
        c ? `${a} ${b} ${c}` : b ? `${a} ${b}` : a
      );
    }
    e.target.value = v;
  });

  // ---- AUTO ESCALÃO from birthdate ---- //
  const dataNasc = document.getElementById('dataNasc');
  const categoria = document.getElementById('categoria');

  dataNasc?.addEventListener('change', () => {
    if (!isFutebol()) return;
    const birth = new Date(dataNasc.value);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;

    if (age >= 7  && age <= 9)  categoria.value = 'sub9';
    else if (age >= 10 && age <= 11) categoria.value = 'sub11';
    else if (age >= 12 && age <= 13) categoria.value = 'sub13';
    else if (age >= 14 && age <= 15) categoria.value = 'sub15';
    else if (age >= 16 && age <= 17) categoria.value = 'sub17';
    else if (age >= 18 && age <= 19) categoria.value = 'sub19';
  });

  // ---- FORM SUBMIT SETUP ---- //
  const form    = document.getElementById('inscForm');
  const success = document.getElementById('inscSuccess');

  // ---- FORM VALIDATION ---- //
  function setFieldError(fieldId, msg) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.classList.add('is-invalid');
    el.setAttribute('aria-invalid', 'true');
    const parent = el.closest('.form-group') || el.parentElement;
    let err = parent.querySelector('.field-error');
    if (!err) {
      err = document.createElement('span');
      err.className = 'field-error';
      err.setAttribute('role', 'alert');
      parent.appendChild(err);
    }
    err.textContent = msg;
    err.classList.add('visible');
  }

  function clearFieldError(el) {
    el.classList.remove('is-invalid');
    el.removeAttribute('aria-invalid');
    const parent = el.closest('.form-group') || el.parentElement;
    parent.querySelector('.field-error')?.classList.remove('visible');
  }

  function validateForm(form) {
    // Clear previous errors
    form.querySelectorAll('.is-invalid').forEach(el => {
      el.classList.remove('is-invalid');
      el.removeAttribute('aria-invalid');
    });
    form.querySelectorAll('.field-error').forEach(el => el.classList.remove('visible'));

    let valid = true;

    const nome = document.getElementById('nomeAtleta');
    if (!nome?.value.trim()) { setFieldError('nomeAtleta', 'Nome completo obrigatório.'); valid = false; }

    const dob = document.getElementById('dataNasc');
    if (!dob?.value) { setFieldError('dataNasc', 'Data de nascimento obrigatória.'); valid = false; }

    if (isFutebol()) {
      const cat = document.getElementById('categoria');
      if (!cat?.value) { setFieldError('categoria', 'Escolha um escalão.'); valid = false; }
    }

    const tel = document.getElementById('telefoneResp');
    if (!tel?.value.trim()) { setFieldError('telefoneResp', 'Telefone obrigatório.'); valid = false; }

    const email = document.getElementById('emailResp');
    if (email?.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      setFieldError('emailResp', 'E-mail inválido.'); valid = false;
    }

    const cp = document.getElementById('codigoPostal');
    if (!cp?.value.trim()) {
      setFieldError('codigoPostal', 'Código postal obrigatório.'); valid = false;
    } else if (!/^\d{4}-\d{3}$/.test(cp.value)) {
      setFieldError('codigoPostal', 'Formato inválido — use XXXX-XXX (ex: 8100-610).'); valid = false;
    }

    const rua = document.getElementById('rua');
    if (!rua?.value.trim()) { setFieldError('rua', 'Morada obrigatória.'); valid = false; }

    const termos = document.getElementById('termos');
    if (!termos?.checked) { setFieldError('termos', 'Deve aceitar os termos para continuar.'); valid = false; }

    if (!valid) {
      const first = form.querySelector('.is-invalid');
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      first?.focus();
    }
    return valid;
  }

  // Clear individual field error on correction
  form?.addEventListener('input', e => {
    if (e.target.classList.contains('is-invalid')) clearFieldError(e.target);
  });
  form?.addEventListener('change', e => {
    if (e.target.classList.contains('is-invalid')) clearFieldError(e.target);
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;
    const btn = form.querySelector('button[type="submit"]');
    btn.textContent = 'A enviar...';
    btn.disabled = true;

    const modalidade = document.querySelector('input[name="modalidade"]:checked')?.value || 'Futebol';
    const g = id => document.getElementById(id)?.value || '';
    const insc = {
      id:          Date.now(),
      modalidade,
      nome:        g('nomeAtleta'),
      dataNasc:    g('dataNasc'),
      nifAtleta:   g('nifAtleta'),
      escalao:     isFutebol() ? g('categoria') : '',
      nivel:       !isFutebol() ? g('nivel') : '',
      posicao:     g('posicao'),
      pePreferido: g('pePreferido'),
      altura:      g('altura'),
      peso:        g('peso'),
      experiencia: g('experiencia'),
      nomeResp:    g('nomeResp'),
      parentesco:  g('parentesco'),
      telefone:    g('telefoneResp'),
      email:       g('emailResp'),
      codigoPostal:g('codigoPostal'),
      localidade:  g('localidade'),
      rua:         g('rua'),
      numero:      g('numero'),
      data:        new Date().toISOString().slice(0, 10),
      estado:      'Pendente',
    };

    // Guardar em localStorage
    try {
      const lst = JSON.parse(localStorage.getItem('db_inscricoes_modalidades') || '[]');
      lst.unshift(insc);
      localStorage.setItem('db_inscricoes_modalidades', JSON.stringify(lst));
    } catch(_) {}

    // Enviar email de notificação (se configurado)
    if (typeof sendEmail === 'function') {
      await sendEmail('tplInscricao', {
        nome:       insc.nome,
        modalidade: insc.modalidade,
        escalao:    insc.escalao || '—',
        nivel:      insc.nivel   || '—',
        posicao:    insc.posicao || '—',
        telefone:   insc.telefone,
        email_resp: insc.email,
        data:       insc.data,
      }).catch(() => {});
    }

    form.reset();
    // Reset modality picker visual
    document.querySelectorAll('.modality-pick').forEach((l, i) => l.classList.toggle('modality-pick--active', i === 0));
    applyModalidade();
    btn.textContent = 'Enviar inscrição';
    btn.disabled = false;
    if (success) {
      success.style.display = 'block';
      success.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => { success.style.display = 'none'; }, 8000);
    }
  });

});
