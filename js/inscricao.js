// =============================================
// INSCRIÇÃO PAGE — JS
// =============================================

document.addEventListener('DOMContentLoaded', () => {

  // ---- PHONE MASK ---- //
  const maskPhone = (el) => {
    if (!el) return;
    el.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '');
      if (v.length <= 10) {
        v = v.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
      } else {
        v = v.replace(/^(\d{2})(\d{1})(\d{4})(\d{0,4})/, '($1) $2 $3-$4');
      }
      e.target.value = v;
    });
  };

  maskPhone(document.getElementById('telefoneResp'));

  // ---- CPF MASK ---- //
  const cpf = document.getElementById('cpfAtleta');
  cpf?.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    e.target.value = v;
  });

  // ---- CEP MASK ---- //
  const cep = document.getElementById('cep');
  cep?.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 8);
    v = v.replace(/(\d{5})(\d)/, '$1-$2');
    e.target.value = v;
  });

  // ---- AUTO CATEGORY from birthdate ---- //
  const dataNasc = document.getElementById('dataNasc');
  const categoria = document.getElementById('categoria');

  dataNasc?.addEventListener('change', () => {
    const birth = new Date(dataNasc.value);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;

    if (age >= 7 && age <= 9) categoria.value = 'sub9';
    else if (age >= 10 && age <= 11) categoria.value = 'sub11';
    else if (age >= 12 && age <= 13) categoria.value = 'sub13';
    else if (age >= 14 && age <= 15) categoria.value = 'sub15';
    else if (age >= 16 && age <= 17) categoria.value = 'sub17';
    else if (age >= 18 && age <= 20) categoria.value = 'sub20';
  });

  // ---- FORM SUBMIT ---- //
  const form = document.getElementById('inscForm');
  const success = document.getElementById('inscSuccess');

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.textContent = 'Enviando...';
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
