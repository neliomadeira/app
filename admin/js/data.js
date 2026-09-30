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
    { id:1, nome:'Kickboxing', icone:'🥊', descricao:'Artes marciais de impacto que combinam técnicas de boxe e karaté. Aberto a todas as idades e níveis, com grupos adaptados.', treinos:'', responsavel:'', local:'', ativo:true, imagem:'', imagemPos:'center' },
    { id:2, nome:'Judo',       icone:'🥋', descricao:'Arte marcial japonesa focada em técnicas de projeção e imobilização. Desenvolve disciplina, respeito e autoconfiança desde criança.', treinos:'', responsavel:'', local:'', ativo:true, imagem:'', imagemPos:'center' },
    { id:3, nome:'Futsal',     icone:'⚽', descricao:'Futebol em espaço reduzido que potencia a técnica e velocidade de decisão. Escalões de formação com competição distrital.', treinos:'', responsavel:'', local:'', ativo:true, imagem:'', imagemPos:'center' },
  ],

  senioresInfo: {
    temporada: '2026/2027',
    liga: 'Competições da AF Algarve',
    treinador: '',
    treinos: '',
    estadio: 'Campo Municipal N.º 2 - Loulé',
    descricao: 'A equipa sénior do J.S. Campinense representa o clube nas competições organizadas pela AF Algarve.',
  },

  seniores: [],
  // Identidade do clube. É configuração verdadeira, como os escalões e as
  // modalidades, e por isso arranca preenchida.
  //
  // Os quatro valores são exactamente os que o site já publica hoje, escritos à
  // mão no HTML de 17 páginas e no js/seo.js: nada foi inventado nem alterado.
  // Passam a ter um sítio só, e o painel a poder mudá-los.
  //
  // O ano de fundação arranca VAZIO, de propósito: a decisão do Bloco 8 foi que
  // um campo vazio não inventa 1947. Enquanto ninguém o escrever no painel, os
  // dados estruturados saem sem foundingDate — que é melhor do que uma data que
  // o clube não confirmou por esta via.
  dadosClube: {
    nome:    'Juventude Sport Campinense',
    sigla:   'JS Campinense',
    navNome: 'JS Campinense',
    navSub:  'Juventude',
    ano:     '',
    estadio: '',
    logo:    '',
  },

  // Cronologia e palmarés do clube. São factos históricos, não conteúdo de
  // exemplo: é por isso que estão aqui ao lado dos escalões, das modalidades
  // e da época dos seniores, e não nas listas que arrancam vazias.
  //
  // Esta é a ÚNICA semente. Havia três cópias completas destes 38 registos —
  // em js/historia.js, em admin/js/admin.js e em js/pesquisa.js. Saíram as
  // três: o site público nunca recupera factos a partir do código, e uma base
  // vazia mostra o estado vazio em vez de inventar história.
  //
  // O campo ativo permite despublicar sem eliminar. Ausente conta como ativo,
  // para não esconder registos antigos que não o tenham.
  historia: [
    { id: 1, ano: 1947, titulo: 'Fundação do Clube', descricao: 'O Juventude Sport Campinense é fundado em Loulé a 12 de dezembro de 1947, ligado à juventude e à comunidade louletana. Pedro Correia Bota, jogador e fundador, orientou o clube nos primeiros anos.', imagem: '', destaque: true, ativo: true },
    { id: 2, ano: 1948, titulo: 'Filiação desportiva', descricao: 'O clube é federado a 8 de janeiro, iniciando o seu percurso oficial na Associação de Futebol do Algarve.', imagem: '', destaque: false, ativo: true },
    { id: 3, ano: 1950, titulo: 'Crescimento e implantação local', descricao: 'Ao longo das décadas de 1950 e 1960, o Campinense consolida a presença na vida desportiva de Loulé. O futebol torna-se a principal modalidade, com participação em competições regionais e distritais.', imagem: '', destaque: false, ativo: true },
    { id: 4, ano: 1978, titulo: 'Ascensão competitiva', descricao: 'No final da década de 1970, o clube inicia uma das fases mais fortes da sua história no futebol sénior, afirmando-se nas competições nacionais.', imagem: '', destaque: false, ativo: true },
    { id: 5, ano: 1982, titulo: 'Melhor campanha na Taça de Portugal', descricao: 'Na época de 1981/82, o clube alcança os 1/32 de final — a melhor campanha conhecida nas suas 12 participações na Taça de Portugal.', imagem: '', destaque: true, ativo: true },
    { id: 6, ano: 1984, titulo: 'Campeão da Série F da III Divisão Nacional', descricao: 'Na época de 1983/84, o Campinense vence a Série F da III Divisão Nacional e conquista o acesso ao segundo escalão do futebol português.', imagem: '', destaque: true, ativo: true },
    { id: 7, ano: 1985, titulo: 'II Divisão Nacional — Zona Sul', descricao: 'Em 1984/85, o clube disputa a II Divisão Nacional, o ponto competitivo mais elevado da sua história. No total: uma época na II Divisão, nove na III Divisão e doze presenças na Taça de Portugal.', imagem: '', destaque: true, ativo: true },
    { id: 9, ano: 1994, titulo: 'Criação da secção de boxe', descricao: 'Nasce a secção de boxe, com atletas de formação, manutenção e competição — incluindo trabalho de inclusão através do boxe adaptado.', imagem: '', destaque: false, ativo: true },
    { id: 10, ano: 1995, titulo: 'Medalha Municipal de Mérito — Grau Prata', descricao: 'A Câmara Municipal de Loulé distingue o clube pelo seu papel na promoção do desporto, na formação dos jovens e na vida social do concelho.', imagem: '', destaque: true, ativo: true },
    { id: 11, ano: 2001, titulo: 'Utilidade pública', descricao: 'O clube é reconhecido como pessoa coletiva de utilidade pública, confirmando oficialmente a sua relevância social, associativa e desportiva.', imagem: '', destaque: false, ativo: true },
    { id: 12, ano: 2006, titulo: 'Campeão Distrital e Taça do Algarve', descricao: 'Época dourada em 2005/06: conquista do Campeonato Distrital da 1.ª Divisão da AF Algarve e da Taça do Algarve, garantindo o regresso às competições nacionais.', imagem: '', destaque: true, ativo: true },
    { id: 13, ano: 2007, titulo: 'Regresso aos campeonatos nacionais', descricao: 'O clube disputa três épocas consecutivas na III Divisão Nacional (2006/07 a 2008/09) e volta a marcar presença na Taça de Portugal.', imagem: '', destaque: false, ativo: true },
    { id: 14, ano: 2010, titulo: 'Aposta reforçada na formação', descricao: 'Durante a década de 2010, a formação torna-se um dos pilares do projeto desportivo, com trabalho regular em vários escalões, dos mais jovens aos juniores.', imagem: '', destaque: false, ativo: true },
    { id: 15, ano: 2017, titulo: 'Iniciados Campeões do Algarve', descricao: 'Na época de 2016/17, os Iniciados conquistam um título inédito de Campeões do Algarve e o acesso ao Campeonato Nacional de Iniciados.', imagem: '', destaque: true, ativo: true },
    { id: 16, ano: 2018, titulo: 'Torneios e futsal feminino', descricao: 'Realiza-se o V Torneio Humberto Faísca e o clube promove o torneio e o Algarve Invitational de futsal feminino.', imagem: '', destaque: false, ativo: true },
    { id: 17, ano: 2019, titulo: 'Kickboxing e formação em destaque', descricao: 'Atletas do clube conquistam títulos no kickboxing e os Traquinas A vencem a Mértola Cup.', imagem: '', destaque: false, ativo: true },
    { id: 18, ano: 2020, titulo: 'Resiliência e multidesporto', descricao: 'O clube adapta-se às restrições da pandemia mantendo a ligação a atletas e famílias. Cristina Azevedo sagra-se vice-campeã nacional de ciclismo (Masters 40) em representação do Campinense.', imagem: '', destaque: false, ativo: true },
    { id: 19, ano: 2021, titulo: 'Entidade Formadora de Três Estrelas', descricao: 'A FPF certifica o clube como Entidade Formadora de Três Estrelas. Nasce a Campinense Cup e o projeto de futsal feminino ganha novo impulso.', imagem: '', destaque: true, ativo: true },
    { id: 20, ano: 2022, titulo: 'Iniciados vencem a Challenge Cup', descricao: 'Novo momento de destaque da formação, seguido do título distrital da 2.ª Divisão em 2022/23, com subida à 1.ª Divisão.', imagem: '', destaque: false, ativo: true },
    { id: 21, ano: 2024, titulo: 'Futsal feminino em força', descricao: 'A equipa sénior feminina vence a Taça de Campeão de Inverno e o clube realiza a II Maratona de Futsal Feminino, dinamizando a modalidade no Algarve.', imagem: '', destaque: false, ativo: true },
    { id: 22, ano: 2025, titulo: 'Campeão da Liga Algarve de Futsal Feminino', descricao: 'Título da Liga Algarve de Futsal Feminino em 2024/25, subida dos Juvenis (Sub-17) à 1.ª Divisão Distrital e quarta edição da Campinense Cup.', imagem: '', destaque: true, ativo: true },
    { id: 23, ano: 2026, titulo: 'Âmbito nacional e novos torneios', descricao: 'A equipa sénior feminina participa na Taça Nacional de Futsal Feminino 2025/26. Realizam-se o IX Torneio Humberto Faísca e o II Torneio de Futebol Feminino.', imagem: '', destaque: false, ativo: true },
  ],

  palmares: [
    { id: 1, competicao: 'III Divisão Nacional — Série F', escalao: 'Seniores', ano: 1984, observacao: 'Campeão — subida histórica à II Divisão', ativo: true },
    { id: 2, competicao: 'Campeonato Distrital 1.ª Divisão AF Algarve', escalao: 'Seniores', ano: 2006, observacao: 'Campeão — dobradinha inédita', ativo: true },
    { id: 3, competicao: 'Taça do Algarve', escalao: 'Seniores', ano: 2006, observacao: 'Vencedor — dobradinha inédita', ativo: true },
    { id: 4, competicao: 'Campeonato do Algarve', escalao: 'Iniciados', ano: 2017, observacao: 'Campeão — acesso ao Nacional (feito inédito)', ativo: true },
    { id: 5, competicao: 'Liga 2 Algarve', escalao: 'Iniciados', ano: 2023, observacao: 'Campeão — subida à Liga 1', ativo: true },
    { id: 6, competicao: 'Challenge Cup', escalao: 'Iniciados', ano: 2022, observacao: 'Vencedor (torneio)', ativo: true },
    { id: 7, competicao: 'Mértola Cup', escalao: 'Traquinas A', ano: 2019, observacao: 'Vencedor (torneio)', ativo: true },
    { id: 8, competicao: 'Liga 2 Algarve', escalao: 'Juvenis (Sub-17)', ano: 2025, observacao: '2.º lugar — subida à 1.ª Divisão Distrital', ativo: true },
    { id: 9, competicao: 'Liga Algarve de Futsal Feminino', escalao: 'Sen. Femininos', ano: 2025, observacao: 'Campeã', ativo: true },
    { id: 10, competicao: 'Taça de Campeão de Inverno Feminina', escalao: 'Sen. Femininos', ano: 2024, observacao: 'Vencedora', ativo: true },
    { id: 11, competicao: 'Taça do Algarve (Futsal Feminino)', escalao: 'Sen. Femininos', ano: 2025, observacao: 'Finalista', ativo: true },
    { id: 12, competicao: 'Campeonato Nacional WKU (–73,5 kg)', escalao: 'Ângelo Cordeiro', ano: 2019, observacao: 'Campeão Nacional', ativo: true },
    { id: 13, competicao: 'Kick-Light (–55 kg)', escalao: 'Matilde Hervê', ano: 2019, observacao: 'Vitória em Almodôvar', ativo: true },
    { id: 16, competicao: 'Campeonato Nacional de Kickboxing — Kick Light', escalao: 'Thomas Almeida', ano: 2026, observacao: 'Vice-Campeão Nacional — Odivelas', ativo: true },
    { id: 14, competicao: 'Campeonato Nacional de Ciclismo — Masters 40', escalao: 'Cristina Azevedo', ano: 2020, observacao: 'Vice-campeã nacional', ativo: true },
    { id: 15, competicao: '2.ª Divisão Nacional de Ténis de Mesa', escalao: 'Equipa', ano: 2012, observacao: 'Subida de divisão (2011/12)', ativo: true },
  ],
};
// O que arranca preenchido e o que arranca vazio.
//
// Escalões, modalidades, a época dos seniores, a história e a identidade do
// clube são configuração e factos verdadeiros: sem eles a formação, os
// escalões, a História e o rodapé ficam sem nada.
// Tudo o resto — atletas, jogos, notícias, patrocinadores, treinadores,
// inscrições, mensagens, galeria, agenda, plantel sénior — era inventado,
// e passa a arrancar vazio. O painel mostra o que existir de verdade.
const DB = {
  escaloes:       DEMO_DB.escaloes,
  modalidades:    DEMO_DB.modalidades,
  senioresInfo:   DEMO_DB.senioresInfo,
  historia:       DEMO_DB.historia,
  palmares:       DEMO_DB.palmares,
  dadosClube:     DEMO_DB.dadosClube,

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
