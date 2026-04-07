// =============================================
// INSCRIÇÃO PAGE — JS (Portugal)
// =============================================

document.addEventListener('DOMContentLoaded', () => {

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
    // Keep leading +351 if typed
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
    const birth = new Date(dataNasc.value);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;

    if (age >= 7 && age <= 9)   categoria.value = 'sub9';
    else if (age >= 10 && age <= 11) categoria.value = 'sub11';
    else if (age >= 12 && age <= 13) categoria.value = 'sub13';
    else if (age >= 14 && age <= 15) categoria.value = 'sub15';
    else if (age >= 16 && age <= 17) categoria.value = 'sub17';
    else if (age >= 18 && age <= 19) categoria.value = 'sub19';
  });

  // ---- FORM SUBMIT ---- //
  const form = document.getElementById('inscForm');
  const success = document.getElementById('inscSuccess');

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.textContent = 'A enviar...';
    btn.disabled = true;

    setTimeout(() => {
      form.reset();
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
