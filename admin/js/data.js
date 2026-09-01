// =============================================
// MOCK DATA — Sport Campinense Juventude
// =============================================

const DB = {
  inscricoes: [
    { id: 1, nome: 'Miguel Ferreira Santos',   escalao: 'Sub-13', idade: 12, telefone: '+351 912 345 678', email: 'miguel.pai@gmail.com',    data: '2026-04-01', estado: 'Pendente',  posicao: 'Médio',        pref: 'Direito',   altura: 152, peso: 45 },
    { id: 2, nome: 'Tomás Rodrigues Costa',    escalao: 'Sub-15', idade: 14, telefone: '+351 963 456 789', email: 'tomas.mae@outlook.pt',     data: '2026-04-02', estado: 'Pendente',  posicao: 'Avançado',     pref: 'Direito',   altura: 168, peso: 58 },
    { id: 3, nome: 'João Almeida Pereira',     escalao: 'Sub-17', idade: 16, telefone: '+351 934 567 890', email: 'joao.resp@sapo.pt',        data: '2026-04-03', estado: 'Pendente',  posicao: 'Extremo',      pref: 'Esquerdo',  altura: 175, peso: 65 },
    { id: 4, nome: 'Diogo Nunes Marques',      escalao: 'Sub-9',  idade: 8,  telefone: '+351 915 678 901', email: 'diogo.pai@gmail.com',      data: '2026-03-20', estado: 'Aprovado',  posicao: '',             pref: 'Direito',   altura: 128, peso: 28 },
    { id: 5, nome: 'Rui Sousa Carvalho',       escalao: 'Sub-11', idade: 10, telefone: '+351 962 789 012', email: 'rui.enc@hotmail.com',      data: '2026-03-18', estado: 'Aprovado',  posicao: 'Médio',        pref: 'Direito',   altura: 140, peso: 35 },
    { id: 6, nome: 'André Lopes Figueiredo',   escalao: 'Sub-13', idade: 13, telefone: '+351 933 890 123', email: 'andre.familia@gmail.com',  data: '2026-03-15', estado: 'Rejeitado', posicao: 'Central',      pref: 'Direito',   altura: 158, peso: 50 },
    { id: 7, nome: 'Pedro Gomes Rodrigues',    escalao: 'Sub-19', idade: 18, telefone: '+351 916 901 234', email: 'pedro.gomes@gmail.com',    data: '2026-03-10', estado: 'Aprovado',  posicao: 'Guarda-redes', pref: 'Direito',   altura: 185, peso: 78 },
  ],

  atletas: [
    { id: 1,  nome: 'Diogo Nunes Marques',       escalao: 'Sub-9',  posicao: '',             dataNascimento: '2018-04-13', encarregado: 'Carlos Nunes',    telefone: '+351 915 678 901', estado: 'Activo'   },
    { id: 2,  nome: 'Rui Sousa Carvalho',         escalao: 'Sub-11', posicao: 'Médio',        dataNascimento: '2016-07-22', encarregado: 'Ana Carvalho',    telefone: '+351 962 789 012', estado: 'Activo'   },
    { id: 3,  nome: 'Luís Tavares Brito',         escalao: 'Sub-11', posicao: 'Avançado',     dataNascimento: '2015-11-08', encarregado: 'Mário Tavares',   telefone: '+351 935 111 222', estado: 'Activo'   },
    { id: 4,  nome: 'Rafael Castro Mota',         escalao: 'Sub-13', posicao: 'Extremo',      dataNascimento: '2014-03-30', encarregado: 'Paulo Castro',    telefone: '+351 912 222 333', estado: 'Activo'   },
    { id: 5,  nome: 'Gonçalo Pires Mendes',       escalao: 'Sub-13', posicao: 'Central',      dataNascimento: '2013-09-15', encarregado: 'Sofia Pires',     telefone: '+351 963 333 444', estado: 'Activo'   },
    { id: 6,  nome: 'Tiago Ferreira Lima',        escalao: 'Sub-15', posicao: 'Defesa Dir.',  dataNascimento: '2012-06-01', encarregado: 'Jorge Ferreira',  telefone: '+351 934 444 555', estado: 'Activo'   },
    { id: 7,  nome: 'Bernardo Santos Cruz',       escalao: 'Sub-15', posicao: 'Médio Def.',   dataNascimento: '2011-02-19', encarregado: 'Carla Santos',    telefone: '+351 916 555 666', estado: 'Activo'   },
    { id: 8,  nome: 'Francisco Lopes Vaz',        escalao: 'Sub-17', posicao: 'Avançado',     dataNascimento: '2010-08-05', encarregado: 'António Lopes',   telefone: '+351 962 666 777', estado: 'Activo'   },
    { id: 9,  nome: 'Martim Costa Azevedo',       escalao: 'Sub-17', posicao: 'Extremo',      dataNascimento: '2009-12-27', encarregado: 'Rosa Costa',      telefone: '+351 933 777 888', estado: 'Activo'   },
    { id: 10, nome: 'Pedro Gomes Rodrigues',      escalao: 'Sub-19', posicao: 'Guarda-redes', dataNascimento: '2008-05-14', encarregado: '-',               telefone: '+351 916 901 234', estado: 'Activo'   },
    { id: 11, nome: 'Rodrigo Alves Monteiro',     escalao: 'Sub-19', posicao: 'Médio',        dataNascimento: '2007-10-03', encarregado: '-',               telefone: '+351 915 888 999', estado: 'Inactivo' },
  ],

  noticias: [
    { id: 1, titulo: 'Sub-17 vence Olhanense e avança às meias-finais do Campeonato Distrital', categoria: 'Resultado', data: '2026-04-05', publicada: true,  img: 1 },
    { id: 2, titulo: 'Testes de seleção abertos para Sub-13 e Sub-15',                          categoria: 'Seleção',   data: '2026-03-28', publicada: true,  img: 2 },
    { id: 3, titulo: 'Três atletas da formação convocados para a Seleção Regional do Algarve',  categoria: 'Conquista', data: '2026-03-15', publicada: true,  img: 3 },
    { id: 4, titulo: 'Parceria com Escola Secundária de Loulé reforça formação académica',      categoria: 'Clube',     data: '2026-03-05', publicada: false, img: 1 },
  ],

  mensagens: [
    { id: 1, nome: 'Ana Gomes',       email: 'ana.gomes@gmail.com',      telefone: '+351 912 100 200', assunto: 'Inscrição de atleta',   mensagem: 'Gostaria de saber mais informações sobre a inscrição do meu filho de 12 anos.',              data: '2026-04-06', estado: 'Não lida'   },
    { id: 2, nome: 'Paulo Marques',   email: 'paulo.mrq@outlook.pt',     telefone: '+351 963 200 300', assunto: 'Parceria / Patrocínio', mensagem: 'Somos uma empresa local e gostaríamos de discutir possibilidades de patrocínio.',           data: '2026-04-05', estado: 'Não lida'   },
    { id: 3, nome: 'Carla Nogueira',  email: 'carla.nog@sapo.pt',        telefone: '+351 934 300 400', assunto: 'Informações gerais',    mensagem: 'Quais são os horários dos treinos para a categoria Sub-11?',                                data: '2026-04-02', estado: 'Lida'       },
    { id: 4, nome: 'Rui Teixeira',    email: 'rui.teixeira@gmail.com',   telefone: '+351 916 400 500', assunto: 'Testes de seleção',     mensagem: 'O meu filho tem 14 anos e joga a médio. Quando são os próximos testes de seleção?',         data: '2026-03-30', estado: 'Respondida' },
  ],

  escaloes: [
    { id: 7, nome: 'Sub-5',  designacao: 'Pré-Petizes', faixa: 'Até 5 anos',   atletas: 0, treinador: '', treinos: '', destaque: false },
    { id: 8, nome: 'Sub-7',  designacao: 'Petizes',     faixa: '6 a 7 anos',   atletas: 0, treinador: '', treinos: '', destaque: false },
    { id: 1, nome: 'Sub-9',  designacao: 'Traquinas',    faixa: '8 a 9 anos',   atletas: 18, treinador: 'Ricardo Matos',   treinos: '3ª, 5ª — 17h30', destaque: false },
    { id: 2, nome: 'Sub-11', designacao: 'Benjamins',  faixa: '10 a 11 anos', atletas: 22, treinador: 'Jorge Pinto',     treinos: '3ª, 5ª, Sáb — 17h30', destaque: false },
    { id: 3, nome: 'Sub-13', designacao: 'Infantis',  faixa: '12 a 13 anos', atletas: 26, treinador: 'Nuno Carvalho',   treinos: '2ª, 4ª, 6ª — 18h00', destaque: true  },
    { id: 4, nome: 'Sub-15', designacao: 'Iniciados',   faixa: '14 a 15 anos', atletas: 24, treinador: 'Filipe Gomes',    treinos: '2ª, 4ª, 6ª — 18h30', destaque: false },
    { id: 5, nome: 'Sub-17', designacao: 'Juvenis',  faixa: '16 a 17 anos', atletas: 20, treinador: 'André Monteiro',  treinos: '2ª a 6ª — 18h30', destaque: false },
    { id: 6, nome: 'Sub-19', designacao: 'Juniores',    faixa: '18 a 19 anos', atletas: 18, treinador: 'Sérgio Fonseca',  treinos: '2ª a 6ª — 19h00', destaque: false },
  ],

  jogos: [
    { id:1,  escalao:'Sub-17', casa:'Sport Campinense', fora:'CD Tavira',         gcasa:3,    gfora:1,    data:'2026-03-22', hora:'10:30', local:'Est. Municipal Loulé',     estado:'Realizado' },
    { id:2,  escalao:'Sub-17', casa:'GD Silves',        fora:'Sport Campinense',  gcasa:1,    gfora:2,    data:'2026-03-15', hora:'15:00', local:'Campo de Silves',          estado:'Realizado' },
    { id:3,  escalao:'Sub-17', casa:'Sport Campinense', fora:'Olhanense',         gcasa:null, gfora:null, data:'2026-04-12', hora:'10:30', local:'Est. Municipal Loulé',     estado:'Agendado'  },
    { id:4,  escalao:'Sub-17', casa:'CD Portimão',      fora:'Sport Campinense',  gcasa:null, gfora:null, data:'2026-04-19', hora:'11:00', local:'Campo Municipal Portimão', estado:'Agendado'  },
    { id:5,  escalao:'Sub-15', casa:'Sport Campinense', fora:'FC Quarteira',      gcasa:3,    gfora:0,    data:'2026-03-29', hora:'09:00', local:'Est. Municipal Loulé',     estado:'Realizado' },
    { id:6,  escalao:'Sub-15', casa:'SC Farense',       fora:'Sport Campinense',  gcasa:1,    gfora:2,    data:'2026-03-22', hora:'09:30', local:'Estádio Algarve',          estado:'Realizado' },
    { id:7,  escalao:'Sub-15', casa:'Sport Campinense', fora:'Olhanense',         gcasa:null, gfora:null, data:'2026-04-12', hora:'09:00', local:'Est. Municipal Loulé',     estado:'Agendado'  },
    { id:8,  escalao:'Sub-13', casa:'Sport Campinense', fora:'GD Silves',         gcasa:4,    gfora:1,    data:'2026-03-29', hora:'09:00', local:'Est. Municipal Loulé',     estado:'Realizado' },
    { id:9,  escalao:'Sub-13', casa:'Sport Campinense', fora:'FC Quarteira',      gcasa:null, gfora:null, data:'2026-04-19', hora:'09:00', local:'Est. Municipal Loulé',     estado:'Agendado'  },
    { id:10, escalao:'Sub-19', casa:'Sport Campinense', fora:'SC Farense',        gcasa:1,    gfora:2,    data:'2026-03-28', hora:'15:00', local:'Est. Municipal Loulé',     estado:'Realizado' },
    { id:11, escalao:'Sub-19', casa:'Sport Campinense', fora:'SL Benfica B',      gcasa:null, gfora:null, data:'2026-04-11', hora:'15:00', local:'Est. Municipal Loulé',     estado:'Agendado'  },
  ],

  patrocinadores: [
    { id:1, nome:'Empresa Ouro 1',   sector:'Construção',    tier:'Ouro',   website:'https://exemplo.pt', ativo:true,  desde:'2024' },
    { id:2, nome:'Empresa Ouro 2',   sector:'Automóvel',     tier:'Ouro',   website:'https://exemplo.pt', ativo:true,  desde:'2023' },
    { id:3, nome:'Empresa Prata 1',  sector:'Restauração',   tier:'Prata',  website:'',                   ativo:true,  desde:'2025' },
    { id:4, nome:'Empresa Prata 2',  sector:'Saúde',         tier:'Prata',  website:'',                   ativo:true,  desde:'2025' },
    { id:5, nome:'Empresa Prata 3',  sector:'Tecnologia',    tier:'Prata',  website:'',                   ativo:false, desde:'2024' },
    { id:6, nome:'Empresa Bronze 1', sector:'Comércio',      tier:'Bronze', website:'',                   ativo:true,  desde:'2026' },
    { id:7, nome:'Empresa Bronze 2', sector:'Serviços',      tier:'Bronze', website:'',                   ativo:true,  desde:'2026' },
    { id:8, nome:'Empresa Bronze 3', sector:'Educação',      tier:'Bronze', website:'',                   ativo:true,  desde:'2025' },
    { id:9, nome:'Empresa Bronze 4', sector:'Turismo',       tier:'Bronze', website:'',                   ativo:false, desde:'2024' },
  ],

  videos: [],

  galeria: [
    { id:1, titulo:'Treino Sub-17',               categoria:'Treino',    data:'2026-04-05', url:'', descricao:'Treino tático no estádio municipal' },
    { id:2, titulo:'Jogo Sub-13 vs Silves 4-1',   categoria:'Jogo',      data:'2026-03-29', url:'', descricao:'Grande vitória em casa' },
    { id:3, titulo:'Campeões Distritais Sub-19',  categoria:'Conquista', data:'2026-03-20', url:'', descricao:'Celebração do título distrital' },
    { id:4, titulo:'Torneio de Páscoa Sub-9',     categoria:'Evento',    data:'2026-04-01', url:'', descricao:'Torneio festivo com 8 equipas' },
    { id:5, titulo:'Treino Sub-11',               categoria:'Treino',    data:'2026-04-03', url:'', descricao:'Exercícios de coordenação' },
    { id:6, titulo:'Jogo Sub-15 Sub-17',          categoria:'Jogo',      data:'2026-03-28', url:'', descricao:'Jogo treino entre escalões' },
  ],

  treinadores: [
    { id:1, nome:'Carlos Mendes',    cargo:'Director Técnico',     escalao:'Todos',  telefone:'+351 912 000 001', email:'carlos@jscampinense.pt', desde:'2020', ativo:true  },
    { id:2, nome:'João Silva',       cargo:'Treinador Principal',  escalao:'Sub-17', telefone:'+351 912 000 002', email:'joao@jscampinense.pt',   desde:'2021', ativo:true  },
    { id:3, nome:'Pedro Alves',      cargo:'Treinador Principal',  escalao:'Sub-15', telefone:'+351 912 000 003', email:'pedro@jscampinense.pt',  desde:'2022', ativo:true  },
    { id:4, nome:'Rui Costa',        cargo:'Treinador Adjunto',    escalao:'Sub-17', telefone:'+351 912 000 004', email:'rui@jscampinense.pt',    desde:'2023', ativo:true  },
    { id:5, nome:'Ana Rodrigues',    cargo:'Preparadora Física',   escalao:'Todos',  telefone:'+351 912 000 005', email:'ana@jscampinense.pt',    desde:'2022', ativo:true  },
    { id:6, nome:'Miguel Ferreira',  cargo:'Treinador de Guarda-redes', escalao:'Todos', telefone:'+351 912 000 006', email:'miguel@jscampinense.pt', desde:'2021', ativo:true },
    { id:7, nome:'Sofia Lopes',      cargo:'Psicóloga',            escalao:'Todos',  telefone:'+351 912 000 007', email:'sofia@jscampinense.pt',  desde:'2023', ativo:true  },
    { id:8, nome:'António Gomes',    cargo:'Team Manager',         escalao:'Sub-19', telefone:'+351 912 000 008', email:'antonio@jscampinense.pt',desde:'2020', ativo:false },
  ],

  agenda: [
    { id:1, titulo:'Jogo Sub-17 vs FC Tavira',   tipo:'Jogo',    escalao:'Sub-17', data:'2026-04-12', hora:'15:00', local:'Est. Municipal Loulé',  descricao:'Campeonato Distrital AF Algarve', estado:'Agendado'  },
    { id:2, titulo:'Torneio Primavera Sub-9',     tipo:'Torneio', escalao:'Sub-9',  data:'2026-04-13', hora:'09:00', local:'Campo Sintético Loulé',  descricao:'Torneio festivo de Primavera',     estado:'Agendado'  },
    { id:3, titulo:'Reunião de Pais Sub-13',      tipo:'Reunião', escalao:'Sub-13', data:'2026-04-15', hora:'19:00', local:'Sede do Clube',           descricao:'Reunião trimestral com encarregados', estado:'Agendado' },
    { id:4, titulo:'Treino físico Sub-15',        tipo:'Treino',  escalao:'Sub-15', data:'2026-04-10', hora:'17:30', local:'Est. Municipal Loulé',  descricao:'Treino de preparação física',      estado:'Agendado'  },
    { id:5, titulo:'Jogo Sub-19 vs Portimonense', tipo:'Jogo',    escalao:'Sub-19', data:'2026-04-11', hora:'17:00', local:'Est. Municipal Loulé',  descricao:'Liga Nacional Juvenis',            estado:'Agendado'  },
    { id:6, titulo:'Festa de Encerramento',       tipo:'Outro',   escalao:'Todos',  data:'2026-06-15', hora:'18:00', local:'Pavilhão Municipal',     descricao:'Festa de fim de época',            estado:'Agendado'  },
  ],

  modalidades: [
    { id:1, nome:'Kickboxing', icone:'🥊', descricao:'Artes marciais de impacto que combinam técnicas de boxe e karaté. Aberto a todas as idades e níveis, com grupos adaptados.', treinos:'3ª e 5ª — 19h00', responsavel:'', local:'Pavilhão Municipal de Loulé', ativo:true, imagem:'', imagemPos:'center' },
    { id:2, nome:'Judo',       icone:'🥋', descricao:'Arte marcial japonesa focada em técnicas de projeção e imobilização. Desenvolve disciplina, respeito e autoconfiança desde criança.', treinos:'2ª, 4ª e 6ª — 18h30', responsavel:'', local:'Pavilhão Municipal de Loulé', ativo:true, imagem:'', imagemPos:'center' },
    { id:3, nome:'Futsal',     icone:'⚽', descricao:'Futebol em espaço reduzido que potencia a técnica e velocidade de decisão. Escalões de formação com competição distrital.', treinos:'2ª e 4ª — 20h00', responsavel:'', local:'Pavilhão Desportivo de Loulé', ativo:true, imagem:'', imagemPos:'center' },
  ],

  senioresInfo: {
    temporada: '2025/2026',
    liga: 'Campeonato de Portugal — Série F',
    treinador: '',
    treinos: '3ª, 5ª e 6ª — 20h00',
    estadio: 'Estádio Municipal de Loulé',
    descricao: 'A equipa principal do Sport Campinense de Loulé disputa o Campeonato de Portugal, o terceiro escalão do futebol português.',
  },

  seniores: [
    // Guarda-redes
    { id:1,  nome:'João Rodrigues',   numero:1,  posicao:'GR',  posicaoFull:'Guarda-redes', foto:'', ativo:true },
    { id:2,  nome:'Tiago Melo',       numero:13, posicao:'GR',  posicaoFull:'Guarda-redes', foto:'', ativo:true },
    // Defesas
    { id:3,  nome:'Carlos Ferreira',  numero:2,  posicao:'DEF', posicaoFull:'Defesa Direito', foto:'', ativo:true },
    { id:4,  nome:'André Sousa',      numero:4,  posicao:'DEF', posicaoFull:'Central', foto:'', ativo:true },
    { id:5,  nome:'Rui Almeida',      numero:5,  posicao:'DEF', posicaoFull:'Central', foto:'', ativo:true },
    { id:6,  nome:'Nuno Costa',       numero:3,  posicao:'DEF', posicaoFull:'Defesa Esquerdo', foto:'', ativo:true },
    { id:7,  nome:'Pedro Gomes',      numero:22, posicao:'DEF', posicaoFull:'Defesa Direito', foto:'', ativo:true },
    // Médios
    { id:8,  nome:'Fábio Lopes',      numero:6,  posicao:'MEI', posicaoFull:'Médio Defensivo', foto:'', ativo:true },
    { id:9,  nome:'Luís Tavares',     numero:8,  posicao:'MEI', posicaoFull:'Médio', foto:'', ativo:true },
    { id:10, nome:'Ricardo Pinto',    numero:10, posicao:'MEI', posicaoFull:'Médio Ofensivo', foto:'', ativo:true },
    { id:11, nome:'Diogo Marques',    numero:7,  posicao:'MEI', posicaoFull:'Extremo Direito', foto:'', ativo:true },
    { id:12, nome:'Bruno Santos',     numero:11, posicao:'MEI', posicaoFull:'Extremo Esquerdo', foto:'', ativo:true },
    // Avançados
    { id:13, nome:'Vitor Cunha',      numero:9,  posicao:'AVA', posicaoFull:'Avançado', foto:'', ativo:true },
    { id:14, nome:'Gonçalo Ferreira', numero:19, posicao:'AVA', posicaoFull:'Avançado', foto:'', ativo:true },
    { id:15, nome:'Miguel Brito',     numero:17, posicao:'AVA', posicaoFull:'Ponta de Lança', foto:'', ativo:true },
  ],
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
