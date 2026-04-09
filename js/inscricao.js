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

  // ---- FORM SUBMIT ---- //
  const form    = document.getElementById('inscForm');
  const success = document.getElementById('inscSuccess');

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.textContent = 'A enviar...';
    btn.disabled = true;

    // Save to localStorage
    try {
      const modalidade = document.querySelector('input[name="modalidade"]:checked')?.value || 'Futebol';
      const insc = {
        id:         Date.now(),
        modalidade,
        nome:       document.getElementById('nomeAtleta')?.value || '',
        dataNasc:   document.getElementById('dataNasc')?.value || '',
        escalao:    isFutebol() ? (document.getElementById('categoria')?.value || '') : '',
        nivel:      !isFutebol() ? (document.getElementById('nivel')?.value || '') : '',
        posicao:    document.getElementById('posicao')?.value || '',
        telefone:   document.getElementById('telefoneResp')?.value || '',
        email:      document.getElementById('emailResp')?.value || '',
        data:       new Date().toISOString().slice(0, 10),
        estado:     'Pendente',
      };
      const lst = JSON.parse(localStorage.getItem('db_inscricoes_modalidades') || '[]');
      lst.unshift(insc);
      localStorage.setItem('db_inscricoes_modalidades', JSON.stringify(lst));
    } catch(_) {}

    setTimeout(() => {
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
    }, 1500);
  });

});
