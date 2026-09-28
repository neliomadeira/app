// =============================================
// DADOS DE EXEMPLO — Juventude Sport Campinense
// =============================================
// Isto é conteúdo inventado, para o painel não abrir vazio durante o
// desenvolvimento. NÃO é conteúdo do clube.
//
// Até agora era carregado directamente para o DB, e bastava carregar em
// Publicar para 54 registos fictícios — atletas, jogos, "Empresa Ouro 1",
// treinadores com e-mails inventados — passarem a ser o conteúdo oficial
// do site.
//
// Passa a ficar de lado. O DB arranca vazio e só é preenchido com o que
// estiver guardado. Nada é apagado: o que já esteja no localStorage
// continua lá, e quem publicar é avisado se reconhecer estes registos.
// =============================================

// As listas de pessoas, jogos, notícias e inscrições estavam preenchidas
// com registos inventados — nomes, idades, telemóveis, emails, alturas e
// pesos de menores — num ficheiro que qualquer pessoa pode descarregar.
// Saíram todas. Ficam só as três listas que são estrutura do clube e que
// o painel usa para arrancar: escalões, modalidades e a ficha da equipa
// principal.
//
// O aviso de "registos de exemplo" antes de publicar continua a funcionar:
// compara com o que aqui estiver, e o que aqui não estiver não é
// comparado.
const DEMO_DB = {
  inscricoes: [],

  atletas: [],

  noticias: [],

  mensagens: [],

  escaloes: [
    { id: 7, nome: 'Sub-5',  designacao: 'Pré-Petizes', faixa: 'Até 5 anos',   atletas: 0, treinador: '', treinos: '', descricao: 'Para as crianças mais novas, focado no lúdico.', destaque: false },
    { id: 8, nome: 'Sub-7',  designacao: 'Petizes',     faixa: '6 a 7 anos',   atletas: 0, treinador: '', treinos: '', descricao: 'Fase de sensibilização, sem cariz competitivo oficial.', destaque: false },
    { id: 1, nome: 'Sub-9',  designacao: 'Traquinas',    faixa: '8 a 9 anos',   atletas: 0, treinador: '', treinos: '', descricao: 'Actividades essencialmente recreativas e festas do futebol.', destaque: false },
    { id: 2, nome: 'Sub-11', designacao: 'Benjamins',  faixa: '10 a 11 anos', atletas: 0, treinador: '', treinos: '', descricao: 'Início de uma organização competitiva mais regrada.', destaque: false },
    { id: 3, nome: 'Sub-13', designacao: 'Infantis',  faixa: '12 a 13 anos', atletas: 0, treinador: '', treinos: '', descricao: 'Passagem para modelos de jogo mais complexos.', destaque: true  },
    { id: 4, nome: 'Sub-15', designacao: 'Iniciados',   faixa: '14 a 15 anos', atletas: 0, treinador: '', treinos: '', descricao: 'Escalão importante de transição e consolidação técnica e táctica.', destaque: false },
    { id: 5, nome: 'Sub-17', designacao: 'Juvenis',  faixa: '16 a 17 anos', atletas: 0, treinador: '', treinos: '', descricao: 'Fase altamente competitiva de alto rendimento jovem.', destaque: false },
    { id: 6, nome: 'Sub-19', designacao: 'Juniores',    faixa: '18 a 19 anos', atletas: 0, treinador: '', treinos: '', descricao: 'O último patamar da formação antes do salto para o futebol sénior ou sub-23.', destaque: false },
  ],

  jogos: [],

  patrocinadores: [],

  videos: [],

  galeria: [],

  treinadores: [],

  agenda: [],

  modalidades: [
    { id:1, nome:'Kickboxing', icone:'🥊', descricao:'Artes marciais de impacto que combinam técnicas de boxe e karaté. Aberto a todas as idades e níveis, com grupos adaptados.', treinos:'3ª e 5ª — 19h00', responsavel:'', local:'Pavilhão Municipal de Loulé', ativo:true, imagem:'', imagemPos:'center' },
    { id:2, nome:'Judo',       icone:'🥋', descricao:'Arte marcial japonesa focada em técnicas de projeção e imobilização. Desenvolve disciplina, respeito e autoconfiança desde criança.', treinos:'2ª, 4ª e 6ª — 18h30', responsavel:'', local:'Pavilhão Municipal de Loulé', ativo:true, imagem:'', imagemPos:'center' },
    { id:3, nome:'Futsal',     icone:'⚽', descricao:'Futebol em espaço reduzido que potencia a técnica e velocidade de decisão. Escalões de formação com competição distrital.', treinos:'2ª e 4ª — 20h00', responsavel:'', local:'Pavilhão Desportivo de Loulé', ativo:true, imagem:'', imagemPos:'center' },
  ],

  senioresInfo: {
    temporada: '2026/2027',
    liga: 'Competições da AF Algarve',
    treinador: '',
    treinos: '3ª, 5ª e 6ª — 20h00',
    estadio: 'Campo Municipal N.º 2 - Loulé',
    descricao: 'A equipa sénior do J.S. Campinense representa o clube nas competições organizadas pela AF Algarve.',
  },

  seniores: [],
};
// O que arranca preenchido e o que arranca vazio.
//
// Escalões, modalidades e a época dos seniores são configuração do clube,
// verdadeira: sem elas a página de formação e os escalões ficam sem nada.
// Tudo o resto — atletas, jogos, notícias, patrocinadores, treinadores,
// inscrições, mensagens, galeria, agenda, plantel sénior — era inventado,
// e passa a arrancar vazio. O painel mostra o que existir de verdade.
const DB = {
  escaloes:       DEMO_DB.escaloes,
  modalidades:    DEMO_DB.modalidades,
  senioresInfo:   DEMO_DB.senioresInfo,

  inscricoes:     [],
  atletas:        [],
  noticias:       [],
  mensagens:      [],
  jogos:          [],
  patrocinadores: [],
  videos:         [],
  galeria:        [],
  treinadores:    [],
  agenda:         [],
  seniores:       [],
};


// Reconhece registos que vieram dos dados de exemplo, comparando com o
// DEMO_DB. Serve para avisar antes de publicar: não se apaga nada, porque
// não há forma de saber se alguém já editou um deles e passou a ser real.
window.contarRegistosDeExemplo = function () {
  const campos = { inscricoes:'nome', atletas:'nome', noticias:'titulo', mensagens:'nome',
                   jogos:'casa', patrocinadores:'nome', treinadores:'nome', galeria:'titulo',
                   agenda:'titulo', seniores:'nome', videos:'titulo' };
  const achados = [];
  Object.keys(campos).forEach(function (chave) {
    const campo = campos[chave];
    const exemplo = (DEMO_DB[chave] || []).map(function (r) { return r[campo]; }).filter(Boolean);
    if (!exemplo.length) return;
    const atuais = chave === 'noticias'
      ? (typeof loadNoticias === 'function' ? loadNoticias() : [])
      : (DB[chave] || []);
    const iguais = atuais.filter(function (r) { return exemplo.indexOf(r[campo]) !== -1; });
    if (iguais.length) achados.push({ seccao: chave, n: iguais.length, exemplos: iguais.slice(0, 3).map(function (r) { return r[campo]; }) });
  });
  return achados;
};

// Persistência no localStorage
window.saveDB = function() {
  try {
    localStorage.setItem('db_videos',         JSON.stringify(DB.videos));
    localStorage.setItem('db_atletas',        JSON.stringify(DB.atletas));
    localStorage.setItem('db_jogos',          JSON.stringify(DB.jogos));
    localStorage.setItem('db_escaloes',       JSON.stringify(DB.escaloes));
    localStorage.setItem('db_galeria',        JSON.stringify(DB.galeria));
    localStorage.setItem('db_modalidades',    JSON.stringify(DB.modalidades));
    localStorage.setItem('db_agenda',         JSON.stringify(DB.agenda));
    localStorage.setItem('db_patrocinadores', JSON.stringify(DB.patrocinadores));
    localStorage.setItem('db_treinadores',    JSON.stringify(DB.treinadores));
    localStorage.setItem('db_seniores',       JSON.stringify(DB.seniores));
    localStorage.setItem('db_seniores_info',  JSON.stringify(DB.senioresInfo));
    // Mensagens e inscrições — bridge com formulários públicos
    localStorage.setItem('db_contact_msgs',   JSON.stringify(DB.mensagens));
    localStorage.setItem('db_inscricoes',     JSON.stringify(DB.inscricoes));
  } catch(e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      const libertar = confirm(
        'Armazenamento cheio! As imagens carregadas por ficheiro ocupam demasiado espaço.\n\n' +
        'Clicar OK remove as imagens guardadas localmente das notícias (as que usam URL externo ficam intactas).\n' +
        'Depois use URLs de imagem em vez de ficheiros locais.'
      );
      if (libertar) {
        DB.noticias.forEach(n => { if (n.imagem && n.imagem.startsWith('data:')) n.imagem = ''; });
        try {
          localStorage.setItem('db_noticias', JSON.stringify(DB.noticias));
          localStorage.setItem('db_galeria',  JSON.stringify(DB.galeria));
          localStorage.setItem('db_treinadores', JSON.stringify(DB.treinadores));
          localStorage.setItem('db_seniores', JSON.stringify(DB.seniores));
          alert('Espaço libertado. As notícias foram guardadas sem as imagens locais.');
        } catch(_) {}
      }
    } else {
      alert('ERRO ao guardar dados: ' + e.message + '\nAs alterações não foram guardadas.');
    }
  }
};

(function() {
  // Limpar chave antiga de notícias (db_noticias) — libertava espaço
  // As notícias agora usam a chave 'jsc_noticias' (gerida em admin.js)
  try { localStorage.removeItem('db_noticias'); } catch(_) {}

  try {
    const vi = localStorage.getItem('db_videos');
    const at = localStorage.getItem('db_atletas');
    const jg = localStorage.getItem('db_jogos');
    const e  = localStorage.getItem('db_escaloes');
    const g  = localStorage.getItem('db_galeria');
    const m  = localStorage.getItem('db_modalidades');
    const a  = localStorage.getItem('db_agenda');
    const p  = localStorage.getItem('db_patrocinadores');
    const t  = localStorage.getItem('db_treinadores');
    const s  = localStorage.getItem('db_seniores');
    const si = localStorage.getItem('db_seniores_info');
    if (vi) DB.videos         = JSON.parse(vi);
    if (at) DB.atletas        = JSON.parse(at);
    if (jg) DB.jogos          = JSON.parse(jg);
    if (e)  DB.escaloes       = JSON.parse(e);
    if (g)  DB.galeria        = JSON.parse(g);
    if (m)  DB.modalidades    = JSON.parse(m);
    if (a)  DB.agenda         = JSON.parse(a);
    if (p)  DB.patrocinadores = JSON.parse(p);
    if (t)  DB.treinadores    = JSON.parse(t);
    if (s)  DB.seniores       = JSON.parse(s);
    if (si) DB.senioresInfo   = JSON.parse(si);

    // Bridge: mensagens do formulário de contacto
    const rawMsgs = localStorage.getItem('db_contact_msgs');
    if (rawMsgs !== null) {
      try { DB.mensagens = JSON.parse(rawMsgs); } catch(_) {}
    }

    // Bridge: inscrições — admin-managed tem prioridade; fallback para formulário público
    const rawInscAdmin = localStorage.getItem('db_inscricoes');
    if (rawInscAdmin !== null) {
      try { DB.inscricoes = JSON.parse(rawInscAdmin); } catch(_) {}
    } else {
      const rawInscSite = localStorage.getItem('db_inscricoes_modalidades');
      if (rawInscSite !== null) {
        try {
          const EMAP = { sub9:'Sub-9', sub11:'Sub-11', sub13:'Sub-13', sub15:'Sub-15', sub17:'Sub-17', sub19:'Sub-19' };
          DB.inscricoes = JSON.parse(rawInscSite).map(function(item) {
            var idade = '—';
            if (item.dataNasc) {
              var hoje = new Date(), n = new Date(item.dataNasc + 'T00:00:00');
              var a = hoje.getFullYear() - n.getFullYear();
              if (hoje.getMonth() < n.getMonth() || (hoje.getMonth() === n.getMonth() && hoje.getDate() < n.getDate())) a--;
              if (a >= 0 && a <= 99) idade = a;
            }
            return {
              id:        item.id,
              nome:      item.nome       || '—',
              modalidade:item.modalidade || 'Futebol',
              escalao:   EMAP[item.escalao] || item.escalao || '—',
              nivel:     item.nivel      || '—',
              idade:     idade,
              dataNasc:  item.dataNasc   || '',
              posicao:   item.posicao    || '—',
              pref:      item.pePreferido|| '—',
              altura:    item.altura     || '—',
              peso:      item.peso       || '—',
              nomeResp:  item.nomeResp   || '—',
              telefone:  item.telefone   || '—',
              email:     item.email      || '—',
              data:      item.data       || new Date().toISOString().slice(0,10),
              estado:    item.estado     || 'Pendente',
            };
          });
        } catch(_) {}
      }
    }
  } catch(e) {}
})();
