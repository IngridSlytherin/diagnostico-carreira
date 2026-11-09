/*
 * Motor de regras do avaliador de carreira internacional.
 * Funções puras: recebem texto/dados e devolvem análises. Não acessam rede nem DOM,
 * então rodam no navegador (window.Regras) e no Node (require) para testes.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Regras = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // ---------------------------------------------------------------- utilitários

  function palavras(texto) {
    return String(texto || "").match(/[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9'’+#.-]*/g) || [];
  }

  function limparLinha(linha) {
    return linha.replace(/\s+/g, " ").trim();
  }

  function pct(parte, total) {
    return total ? Math.round(parte / total * 100) : 0;
  }

  function nivel(nota) {
    if (nota === null || nota === undefined) return "Não avaliado";
    if (nota < 40) return "Fraco";
    if (nota < 60) return "Em desenvolvimento";
    if (nota < 75) return "Competitivo";
    if (nota < 90) return "Forte";
    return "Excelente";
  }

  // ok = peso cheio, aviso = metade, critico = zero, info = não conta.
  function pontuar(checks) {
    var total = 0;
    var ganho = 0;
    checks.forEach(function (c) {
      if (c.status === "info") return;
      total += c.peso;
      if (c.status === "ok") ganho += c.peso;
      else if (c.status === "aviso") ganho += c.peso / 2;
    });
    return total ? Math.round(ganho / total * 100) : null;
  }

  function resumirTexto(texto, max) {
    texto = String(texto || "");
    return texto.length > max ? texto.slice(0, max - 1).trim() + "…" : texto;
  }

  // ---------------------------------------------------------------- idioma

  var STOP_EN = ["the", "and", "with", "for", "to", "of", "in", "on", "using", "from", "by", "was", "were", "is", "are", "my", "team", "users", "built", "developed"];
  var STOP_PT = ["de", "para", "com", "em", "uma", "um", "que", "dos", "das", "do", "da", "no", "na", "nos", "pelo", "pela", "não", "também", "através", "desenvolvimento", "sistema", "sistemas", "equipe", "atuei", "desenvolvi"];

  function detectarIdioma(texto) {
    var tokens = palavras(String(texto).toLowerCase());
    var en = 0;
    var pt = 0;
    tokens.forEach(function (t) {
      if (STOP_EN.indexOf(t) !== -1) en++;
      if (STOP_PT.indexOf(t) !== -1) pt++;
    });
    if (en + pt < 5) return "indefinido";
    var razao = pt / (en + pt);
    if (razao > 0.6) return "pt";
    if (razao > 0.25) return "misto";
    return "en";
  }

  // ---------------------------------------------------------------- vocabulário

  var VERBOS_PASSADO = ("accelerated achieved added adopted analyzed architected audited automated boosted built championed " +
    "coded collaborated configured consolidated contributed converted coordinated crafted created cut debugged decreased " +
    "defined delivered deployed designed developed devised documented doubled drove eliminated enabled engineered enhanced " +
    "established evaluated expanded extended facilitated fixed founded generated grew guided halved handled identified " +
    "implemented improved increased initiated integrated introduced launched led maintained managed mapped measured " +
    "mentored merged migrated modeled modernized monitored negotiated onboarded optimized orchestrated organized overhauled " +
    "oversaw owned partnered piloted planned presented programmed proposed prototyped provided published ran rebuilt " +
    "recruited redesigned reduced refactored released removed replaced resolved restructured revamped reviewed rewrote " +
    "saved scaled secured served set shipped simplified solved spearheaded standardized streamlined structured supported " +
    "taught tested trained transformed translated tripled troubleshot unified upgraded validated won wrote made took " +
    "assisted helped worked participated collaborated contributed").split(" ");

  var VERBOS_BASE_IRREGULARES = ("build lead write run drive make set win begin take give keep oversee grow cut teach " +
    "troubleshoot rewrite rebuild").split(" ");

  var NAO_VERBOS = ["experienced", "skilled", "talented", "motivated", "dedicated", "seasoned", "certified", "detailed", "advanced", "based", "related", "used"];

  var VERBO_SET = {};
  VERBOS_PASSADO.concat(VERBOS_BASE_IRREGULARES).forEach(function (v) { VERBO_SET[v] = true; });

  function ehVerboDeAcao(palavra) {
    var w = String(palavra || "").toLowerCase().replace(/[^a-z]/g, "");
    if (!w || NAO_VERBOS.indexOf(w) !== -1) return false;
    if (VERBO_SET[w]) return true;
    function base(b) {
      return VERBO_SET[b] || VERBO_SET[b + "ed"] || VERBO_SET[b + "d"] ||
        VERBO_SET[b.replace(/y$/, "ied")] || VERBO_SET[b + b.slice(-1) + "ed"];
    }
    if (base(w)) return true;
    if (/s$/.test(w) && base(w.replace(/e?s$/, ""))) return true; // builds, fixes
    if (/s$/.test(w) && base(w.slice(0, -1))) return true;
    if (/ing$/.test(w)) {
      var raiz = w.slice(0, -3);
      if (base(raiz) || base(raiz + "e") || base(raiz.slice(0, -1))) return true; // building, creating, shipping
    }
    return false;
  }

  var FRASES_FRACAS = [
    { re: /\bresponsible for\b/i, texto: "responsible for" },
    { re: /\bworked (on|with|in)\b/i, texto: "worked on/with" },
    { re: /^\s*helped\b|\bhelped (to )?\w+/i, texto: "helped" },
    { re: /\bassisted (in|with)\b/i, texto: "assisted in/with" },
    { re: /\bparticipated in\b/i, texto: "participated in" },
    { re: /\binvolved in\b/i, texto: "involved in" },
    { re: /\b(duties|tasks) (included|were|involved)\b/i, texto: "duties/tasks included" },
    { re: /\bin charge of\b/i, texto: "in charge of" }
  ];

  var CLICHES = [/\bhard[- ]?working\b/i, /\bteam player\b/i, /\bdetail[- ]oriented\b/i, /\bpassionate\b/i,
    /\bproactive\b/i, /\bself[- ]motivated\b/i, /\bresults?[- ]driven\b/i, /\bgo[- ]getter\b/i,
    /\bthink outside the box\b/i, /\b(fast|quick) learner\b/i, /\bsynergy\b/i, /\bdynamic\b/i, /\bguru\b/i, /\bninja\b/i, /\brockstar\b/i];

  // Títulos em português também são reconhecidos (para a análise funcionar), mas o check de idioma os aponta.
  var SECOES = [
    { id: "summary", nome: "Summary", essencial: true, re: /^((professional |career |personal )?(summary|profile|about( me)?|objective)|resumo( profissional)?|objetivos?( profissional)?|sobre mim|perfil( profissional)?)(?![\wÀ-ÿ])/i },
    { id: "experience", nome: "Experience", essencial: true, re: /^((professional |work |relevant )?(experience|employment( history)?|work history)|experi[eê]ncias?( profissional| profissionais)?|hist[oó]rico profissional)(?![\wÀ-ÿ])/i },
    { id: "projects", nome: "Projects", essencial: false, re: /^((personal |selected |side |key )?projects|projetos( pessoais)?)(?![\wÀ-ÿ])/i },
    { id: "skills", nome: "Skills", essencial: true, re: /^((technical |core |key |hard )?(skills|tech(nical)? stack|technologies|competencies)|habilidades( t[eé]cnicas)?|compet[eê]ncias|tecnologias|conhecimentos)(?![\wÀ-ÿ])/i },
    { id: "education", nome: "Education", essencial: true, re: /^(education|academic background|forma[cç][aã]o( acad[eê]mica)?|educa[cç][aã]o|escolaridade)(?![\wÀ-ÿ])/i },
    { id: "languages", nome: "Languages", essencial: false, re: /^(languages|idiomas)(?![\wÀ-ÿ])/i },
    { id: "outros", nome: "Outros", essencial: false, re: /^(certifications?|courses|awards|volunteer(ing)?|publications|interests|cursos|certifica[cç][oõ]es)(?![\wÀ-ÿ])/i }
  ];

  var SECAO_PT = /^(experi[eê]ncias?( profissional| profissionais)?|forma[cç][aã]o( acad[eê]mica)?|resumo( profissional)?|objetivos?|habilidades|compet[eê]ncias|idiomas|cursos|projetos|qualifica[cç][oõ]es)\b/i;

  var MARCADOR = /^\s*(?:[•●▪■◦‣⁃∙·►▶➢➤✓✔]\s*|[-–—*]\s+)/;
  var ICONE = /[-]/g;
  var MARCADORES_SIMBOLO = /[]/g;

  var MES = "(?:jan|feb|fev|mar|apr|abr|may|mai|jun|jul|aug|ago|sep|set|oct|out|nov|dec|dez)[a-zç]*\\.?";
  var DATA = "(?:(?:" + MES + "\\s*(?:de\\s*)?)?(?:19|20)\\d{2}|\\d{1,2}/(?:19|20)?\\d{2})";
  var INTERVALO = new RegExp(DATA + "\\s*(?:-|–|—|to|até|a)\\s*(?:" + DATA + "|present|current|now|today|atual|o momento|presente)", "i");

  function temMetrica(texto) {
    var semAnos = texto.replace(/\b(19|20)\d{2}\b/g, "");
    return /\d|%|\$/.test(semAnos) || /\b(doubled|tripled|halved|zero downtime)\b/i.test(texto);
  }

  function detectarSecao(linha) {
    if (linha.length > 60) return null;
    var limpa = linha.replace(/^[#\s]+/, "");
    for (var i = 0; i < SECOES.length; i++) {
      var m = limpa.match(SECOES[i].re);
      if (!m) continue;
      var resto = limpa.slice(m[0].length);
      if (/^\s*:?\s*$/.test(resto)) return { id: SECOES[i].id, resto: "" };
      if (/^\s*[:|–—-]\s*\S/.test(resto)) return { id: SECOES[i].id, resto: resto.replace(/^\s*[:|–—-]\s*/, "") };
    }
    return null;
  }

  function extrairGithub(texto) {
    var m = String(texto).match(/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))(?![A-Za-z0-9-])/i);
    if (!m) return null;
    var reservados = ["orgs", "features", "about", "pricing", "topics", "settings", "login", "join"];
    return reservados.indexOf(m[1].toLowerCase()) === -1 ? m[1] : null;
  }

  // ---------------------------------------------------------------- currículo

  function analisarCurriculo(texto, meta) {
    meta = meta || {};
    texto = String(texto || "");
    var linhas = texto.split(/\r?\n/).map(limparLinha).filter(Boolean);
    var nPalavras = palavras(texto).length;
    var checks = [];

    function add(c) { checks.push(c); }

    if (meta.paginas && nPalavras < 60) {
      add({ id: "texto-extraivel", status: "critico", peso: 5, titulo: "O texto do PDF não pode ser lido",
        detalhe: "Extraí só " + nPalavras + " palavras de " + meta.paginas + " página(s). Provavelmente o PDF é uma imagem (escaneado ou exportado como figura). Sistemas de triagem (ATS) também não conseguem ler.",
        acao: "Exporte o currículo direto do editor (Google Docs, Word) com “Salvar como PDF”, sem converter para imagem." });
      return { pontuacao: 0, nivel: nivel(0), checks: checks, stats: { palavras: nPalavras, paginas: meta.paginas, bullets: 0 }, github: null };
    }

    // --- percorre linhas: seções, bullets
    var atual = "topo";
    var porSecao = { topo: [] };
    var encontradas = {};
    var cabecalhosPt = [];
    var bullets = [];
    var aberto = null;

    linhas.forEach(function (l) {
      if (l.length < 45 && SECAO_PT.test(l)) cabecalhosPt.push(l);
      var h = detectarSecao(l);
      if (h) {
        atual = h.id;
        encontradas[h.id] = true;
        porSecao[atual] = porSecao[atual] || [];
        if (h.resto) porSecao[atual].push(h.resto);
        aberto = null;
        return;
      }
      (porSecao[atual] = porSecao[atual] || []).push(l);

      if (MARCADOR.test(l)) {
        aberto = { texto: l.replace(MARCADOR, "").trim(), secao: atual };
        bullets.push(aberto);
      } else if (aberto && /^[a-z(&,]/.test(l)) {
        aberto.texto += " " + l; // continuação de bullet quebrado pelo PDF
      } else {
        aberto = null;
      }
    });

    var bulletsInferidos = false;
    var secoesDeTrabalho = ["experience", "projects"];
    var temSecaoTrabalho = encontradas.experience || encontradas.projects;
    var avaliaveis = bullets.filter(function (b) {
      return (!temSecaoTrabalho || secoesDeTrabalho.indexOf(b.secao) !== -1) && palavras(b.texto).length >= 4;
    });
    if (avaliaveis.length < 3 && temSecaoTrabalho) {
      var candidatos = [];
      secoesDeTrabalho.forEach(function (s) {
        var anterior = null;
        (porSecao[s] || []).forEach(function (l) {
          if (anterior && /^[a-zà-ÿ(&,]/.test(l)) { anterior.texto += " " + l; return; } // linha quebrada do mesmo bullet
          anterior = INTERVALO.test(l) ? null : { texto: l.replace(MARCADOR, ""), secao: s };
          if (anterior) candidatos.push(anterior);
        });
      });
      candidatos = candidatos.filter(function (c) { return palavras(c.texto).length >= 7; });
      if (candidatos.length > avaliaveis.length) {
        avaliaveis = candidatos;
        bulletsInferidos = true;
      }
    }

    var analise = avaliaveis.map(function (b) {
      var primeira = (b.texto.match(/[A-Za-z]+/) || [""])[0];
      var fraca = null;
      FRASES_FRACAS.forEach(function (f) { if (!fraca && f.re.test(b.texto)) fraca = f.texto; });
      return {
        texto: b.texto,
        verbo: ehVerboDeAcao(primeira) && !/^(helped|assisted|worked|participated)$/i.test(primeira),
        metrica: temMetrica(b.texto),
        fraca: fraca,
        pronome: /\b(I|my|me)\b/.test(b.texto),
        longo: palavras(b.texto).length > 32
      };
    });
    var nB = analise.length;

    // --- 1. idioma
    var idioma = detectarIdioma(texto);
    if (idioma === "pt" || idioma === "misto" || cabecalhosPt.length) {
      add({ id: "idioma", status: idioma === "pt" ? "critico" : "aviso", peso: 4, teto: idioma === "pt" ? 39 : 59, titulo: "Currículo precisa estar 100% em inglês",
        detalhe: idioma === "pt" ? "O texto está majoritariamente em português." : "Há trechos ou títulos em português" + (cabecalhosPt.length ? " (ex.: “" + cabecalhosPt[0] + "”)" : "") + ".",
        acao: "Traduza tudo, inclusive títulos de seção, cargos e descrição dos cursos. Use os títulos padrão: Summary, Experience, Projects, Skills, Education, Languages." });
    } else {
      add({ id: "idioma", status: "ok", peso: 4, titulo: "Currículo em inglês", detalhe: "O texto está em inglês.", acao: "" });
    }

    // --- 1b. campos de modelo não preenchidos
    var marcadores = texto.match(/\[[^\]\n]{2,60}\]|\b(lorem ipsum|xxx+|TODO|PREENCHER|CONFIRMAR)\b/gi) || [];
    if (marcadores.length) {
      add({ id: "modelo", status: "critico", peso: 3, teto: 39, titulo: "Campos do modelo ainda não preenchidos",
        detalhe: marcadores.length + " marcador(es) como " + marcadores.slice(0, 3).join(", ") + ". Um recrutador descarta na hora.",
        acao: "Substitua todos os marcadores por informações reais antes de enviar." });
    }

    // --- 2. seções
    var faltando = SECOES.filter(function (s) { return s.essencial && !encontradas[s.id]; }).map(function (s) { return s.nome; });
    add({ id: "secoes", peso: 2,
      status: faltando.length === 0 ? "ok" : (faltando.indexOf("Experience") !== -1 && !encontradas.projects ? "critico" : "aviso"),
      titulo: "Seções padrão para ATS",
      detalhe: faltando.length ? "Não encontrei: " + faltando.join(", ") + ". Títulos criativos (ex.: “My Journey”) confundem o ATS." : "Encontrei as seções essenciais.",
      acao: faltando.length ? "Adicione ou renomeie as seções: " + faltando.join(", ") + "." : "" });

    // --- 3. tamanho
    var stTam = "ok";
    var detTam = nPalavras + " palavras" + (meta.paginas ? " em " + meta.paginas + " página(s)" : "") + ".";
    var acaoTam = "";
    if (meta.paginas > 2) { stTam = "critico"; acaoTam = "Corte para 1 página (no máximo 2): mantenha os últimos 10 anos e o que é relevante para a vaga."; }
    else if (nPalavras < 150) { stTam = "critico"; acaoTam = "Muito pouco conteúdo para um recrutador avaliar: descreva cada experiência e projeto com 3 a 5 bullets."; }
    else if (nPalavras < 250) { stTam = "aviso"; acaoTam = "Está curto demais: detalhe responsabilidades e resultados de cada experiência e projeto."; }
    else if (nPalavras > 1000 || (meta.paginas === 2 && nPalavras < 550)) { stTam = "aviso"; acaoTam = nPalavras > 1000 ? "Enxugue: recrutadores leem em segundos. Corte bullets antigos ou repetidos." : "Cabe em 1 página: ajuste margens e corte espaços vazios."; }
    add({ id: "tamanho", status: stTam, peso: 1.5, teto: stTam === "critico" ? 59 : null, titulo: "Tamanho", detalhe: detTam, acao: acaoTam });

    // --- 4. contato
    var temEmail = /[\w.+-]+@[\w-]+\.[\w.]+/.test(texto);
    var linkedin = /linkedin\.com\/in\/[\w%-]+/i.test(texto);
    var github = extrairGithub(texto);
    var local = /\b(brazil|brasil|remote|latam|utc\s?-\s?3|gmt\s?-\s?3)\b/i.test(texto);
    add({ id: "email", status: temEmail ? "ok" : "critico", peso: 2, teto: 59, titulo: "E-mail de contato",
      detalhe: temEmail ? "Encontrei um e-mail." : "Não encontrei e-mail no texto.", acao: temEmail ? "" : "Coloque um e-mail profissional no topo." });
    add({ id: "linkedin", status: linkedin ? "ok" : "aviso", peso: 1, titulo: "Link do LinkedIn",
      detalhe: linkedin ? "Encontrei o link do LinkedIn." : "Não encontrei linkedin.com/in/… no texto.",
      acao: linkedin ? "" : "Adicione a URL personalizada do LinkedIn no cabeçalho (ex.: linkedin.com/in/seu-nome)." });
    add({ id: "github", status: github ? "ok" : "aviso", peso: 1, titulo: "Link do GitHub / portfólio",
      detalhe: github ? "Encontrei o GitHub: " + github + "." : "Não encontrei github.com/… no texto.",
      acao: github ? "" : "Para vagas de desenvolvimento, inclua o GitHub ou um portfólio com projetos." });
    add({ id: "localizacao", status: local ? "ok" : "aviso", peso: 1, titulo: "Localização e fuso",
      detalhe: local ? "O currículo indica localização/remoto." : "Não ficou claro de onde você trabalha.",
      acao: local ? "" : "No cabeçalho, escreva algo como “São Paulo, Brazil · Remote (UTC-3)”. Isso ajuda o recrutador a saber se você se encaixa no fuso da vaga." });

    var telefone = /\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/.test(texto);
    if (telefone && !/\+\s?55/.test(texto)) {
      add({ id: "telefone", status: "aviso", peso: 0.5, titulo: "Telefone no formato internacional",
        detalhe: "O telefone parece estar sem o código do país.", acao: "Use o formato +55 11 91234-5678 (ou remova o telefone e deixe só e-mail e LinkedIn)." });
    }

    // --- 5. dados pessoais
    var pessoais = [];
    // "29 anos" é idade; "10 anos de experiência" não
    if (/\b(date of birth|birth ?date|d\.?o\.?b\.?|data de nascimento|nascid[oa] em)\b/i.test(texto) || /\b\d{1,2}\s*(years old|anos de idade)\b/i.test(texto) || /\b\d{2} anos\b(?!\s+(de|em|no|na|como|com)\b)/i.test(texto)) pessoais.push("data de nascimento/idade");
    if (/\bmarital status\b|\bmarried\b|\bdivorced\b|\bcasad[oa]\b|\bsolteir[oa]\b|\bestado civil\b/i.test(texto)) pessoais.push("estado civil");
    if (/\bCPF\b|\bRG\b|\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/.test(texto)) pessoais.push("CPF/RG");
    if (/\b(gender|sexo)\s*:/i.test(texto)) pessoais.push("gênero");
    if (/\b(nationality|nacionalidade)\s*:/i.test(texto) || /\bbrasileir[oa]\s*,/i.test(texto)) pessoais.push("nacionalidade");
    add({ id: "dados-pessoais", status: pessoais.length ? "critico" : "ok", peso: 2, titulo: "Sem dados pessoais desnecessários",
      detalhe: pessoais.length ? "Encontrei: " + pessoais.join(", ") + ". Nos EUA isso não é usado (e empresas evitam receber, por leis antidiscriminação)." : "Não encontrei idade, estado civil ou documentos.",
      acao: pessoais.length ? "Remova " + pessoais.join(", ") + " do currículo." : "" });

    if (meta.imagens > 0) {
      add({ id: "imagens", status: "aviso", peso: 1, titulo: "Imagens no PDF",
        detalhe: "O PDF tem " + meta.imagens + " imagem(ns). Se for foto: no mercado americano, currículo não leva foto.",
        acao: "Remova foto, logotipos e gráficos de habilidades (barras/estrelas). O ATS ignora imagens." });
    }

    // --- 6. formato para ATS
    var icones = (texto.replace(MARCADORES_SIMBOLO, "").match(ICONE) || []).length;
    if (meta.colunas) {
      add({ id: "colunas", status: "aviso", peso: 1.5, teto: 74, titulo: "Layout em colunas",
        detalhe: "O PDF tem duas colunas lado a lado. Este avaliador separou as colunas para analisar, mas muitos ATS leem a linha inteira e misturam o texto das duas.",
        acao: "Use uma coluna só, de cima para baixo. Confira o texto extraído no campo acima: se estiver embaralhado, o ATS vê igual." });
    }
    if (icones > 0) {
      add({ id: "icones", status: "aviso", peso: 1, titulo: "Ícones viram caracteres estranhos",
        detalhe: "Encontrei " + icones + " caractere(s) de ícone (ex.: ícones de telefone, e-mail, estrelas).",
        acao: "Troque ícones por texto simples: “Email:”, “LinkedIn:”." });
    }

    // --- 7. bullets
    if (nB < 3) {
      add({ id: "bullets", status: "critico", peso: 3, teto: 59, titulo: "Experiências descritas em bullets",
        detalhe: "Encontrei só " + nB + " bullet(s) de experiência/projetos.",
        acao: "Descreva cada experiência com 3 a 5 bullets: verbo de ação + o que você fez + resultado." });
    } else {
      var semVerbo = analise.filter(function (b) { return !b.verbo; });
      var pVerbo = pct(nB - semVerbo.length, nB);
      add({ id: "verbos", peso: 3, status: pVerbo >= 80 ? "ok" : pVerbo >= 50 ? "aviso" : "critico",
        titulo: "Bullets começam com verbo de ação",
        detalhe: pVerbo + "% dos " + nB + " bullets começam com verbo de ação" + (bulletsInferidos ? " (não detectei marcadores, então analisei as frases das seções Experience/Projects)" : "") + ".",
        acao: pVerbo >= 80 ? "" : "Comece cada bullet com um verbo no passado: Built, Led, Reduced, Migrated, Automated, Designed.",
        exemplos: semVerbo.slice(0, 3).map(function (b) { return resumirTexto(b.texto, 140); }) });

      var semMetrica = analise.filter(function (b) { return !b.metrica; });
      var pMet = pct(nB - semMetrica.length, nB);
      add({ id: "metricas", peso: 3, status: pMet >= 50 ? "ok" : pMet >= 25 ? "aviso" : "critico",
        titulo: "Resultados com números",
        detalhe: pMet + "% dos bullets têm número, porcentagem ou escala (usuários, tempo, dinheiro, volume).",
        acao: pMet >= 50 ? "" : "Em pelo menos metade dos bullets, mostre o impacto: “Reduced page load time by 40%…”, “…used by 3,000 daily users”. Só use números reais; se for estimativa, seja conservador.",
        exemplos: semMetrica.slice(0, 3).map(function (b) { return resumirTexto(b.texto, 140); }) });

      var fracas = analise.filter(function (b) { return b.fraca; });
      add({ id: "frases-fracas", peso: 2, status: fracas.length === 0 ? "ok" : fracas.length >= 3 ? "critico" : "aviso",
        titulo: "Sem frases passivas (“responsible for”, “worked on”)",
        detalhe: fracas.length ? fracas.length + " bullet(s) descrevem tarefa, não conquista." : "Nenhuma frase fraca encontrada.",
        acao: fracas.length ? "Troque “Responsible for the API” por “Built and maintained the REST API that…”: diga o que você fez e o que mudou." : "",
        exemplos: fracas.slice(0, 3).map(function (b) { return "“" + b.fraca + "” em: " + resumirTexto(b.texto, 120); }) });

      var comPronome = analise.filter(function (b) { return b.pronome; });
      if (comPronome.length) {
        add({ id: "pronomes", status: "aviso", peso: 1, titulo: "Bullets sem “I” / “my”",
          detalhe: comPronome.length + " bullet(s) usam I/my/me. No padrão americano, bullets omitem o sujeito.",
          acao: "Escreva “Built…”, não “I built…”.", exemplos: comPronome.slice(0, 2).map(function (b) { return resumirTexto(b.texto, 120); }) });
      }

      var vistos = {};
      var repetidos = analise.filter(function (b) {
        var chave = b.texto.toLowerCase().replace(/[^a-z]/g, "");
        if (vistos[chave]) return true;
        vistos[chave] = true;
        return false;
      });
      if (repetidos.length) {
        var muitos = repetidos.length >= 3 || repetidos.length / nB > 0.2;
        add({ id: "repetidos", status: muitos ? "critico" : "aviso", peso: 2, teto: muitos ? 59 : null, titulo: "Bullets repetidos",
          detalhe: repetidos.length + " bullet(s) repetem texto de outra experiência. Parece copiar e colar, e esconde o que foi diferente em cada emprego.",
          acao: "Mantenha só o que foi específico de cada experiência; corte experiências antigas ou parecidas.",
          exemplos: repetidos.slice(0, 2).map(function (b) { return resumirTexto(b.texto, 120); }) });
      }

      var longos = analise.filter(function (b) { return b.longo; });
      if (longos.length) {
        add({ id: "bullets-longos", status: "aviso", peso: 1, titulo: "Bullets curtos e escaneáveis",
          detalhe: longos.length + " bullet(s) passam de 32 palavras.", acao: "Mantenha cada bullet em 1–2 linhas. Divida os longos em dois.",
          exemplos: longos.slice(0, 2).map(function (b) { return resumirTexto(b.texto, 120); }) });
      }
    }

    // --- 8. clichês
    var cliches = [];
    CLICHES.forEach(function (re) { var m = texto.match(re); if (m) cliches.push(m[0]); });
    add({ id: "cliches", peso: 1, status: cliches.length === 0 ? "ok" : cliches.length >= 3 ? "critico" : "aviso",
      titulo: "Sem clichês", detalhe: cliches.length ? "Encontrei: " + cliches.join(", ") + "." : "Nenhum clichê encontrado.",
      acao: cliches.length ? "Troque adjetivos por provas: em vez de “passionate team player”, mostre um resultado de equipe." : "" });

    // --- 9. datas
    if (encontradas.experience) {
      var temDatas = (porSecao.experience || []).some(function (l) { return INTERVALO.test(l); });
      add({ id: "datas", status: temDatas ? "ok" : "aviso", peso: 1, titulo: "Datas nas experiências",
        detalhe: temDatas ? "As experiências têm período." : "Não encontrei períodos (ex.: Jan 2022 – Present) na seção Experience.",
        acao: temDatas ? "" : "Coloque mês e ano de início e fim em cada experiência: “Mar 2021 – Present”." });
    }

    // --- 10. inglês declarado
    var nivelIngles = /\benglish\b[^\n]{0,40}\b(fluent|advanced|proficient|native|c1|c2|b2|upper[- ]intermediate|intermediate|professional( working)?|full professional)\b/i.test(texto) ||
      /\b(fluent|advanced|proficient|c1|c2|b2)\b[^\n]{0,20}\benglish\b/i.test(texto);
    add({ id: "ingles-declarado", status: nivelIngles ? "ok" : "aviso", peso: 1, titulo: "Nível de inglês declarado",
      detalhe: nivelIngles ? "O currículo informa o nível de inglês." : "Não encontrei o nível de inglês (ex.: “English: Advanced (C1)”).",
      acao: nivelIngles ? "" : "Inclua uma seção Languages: “Portuguese: Native · English: Advanced (C1, EF SET 65)”. Seja honesto: o nível é testado na primeira call." });

    // --- 11. summary
    if (encontradas.summary) {
      var nSum = palavras((porSecao.summary || []).join(" ")).length;
      add({ id: "summary", status: nSum >= 25 && nSum <= 100 ? "ok" : "aviso", peso: 1, titulo: "Summary objetivo",
        detalhe: "O Summary tem " + nSum + " palavras.",
        acao: nSum < 25 ? "Escreva 2–3 linhas: cargo + anos de experiência + stack principal + um resultado marcante." : nSum > 100 ? "Corte para 2–3 linhas (até ~80 palavras)." : "" });
    }

    // Falhas eliminatórias limitam a nota: um recrutador descarta, não importa o resto.
    var pontuacao = pontuar(checks);
    var limitadaPor = [];
    checks.forEach(function (c) {
      if (c.teto && c.status !== "ok" && pontuacao > c.teto) limitadaPor.push(c.titulo + " (máx. " + c.teto + ")");
    });
    checks.forEach(function (c) { if (c.teto && c.status !== "ok") pontuacao = Math.min(pontuacao, c.teto); });
    return {
      pontuacao: pontuacao,
      nivel: nivel(pontuacao),
      limitadaPor: limitadaPor,
      checks: checks,
      github: github,
      stats: {
        palavras: nPalavras,
        paginas: meta.paginas || null,
        idioma: idioma,
        secoes: Object.keys(encontradas),
        bullets: nB,
        bulletsInferidos: bulletsInferidos,
        comVerboPct: nB ? pct(analise.filter(function (b) { return b.verbo; }).length, nB) : null,
        comMetricaPct: nB ? pct(analise.filter(function (b) { return b.metrica; }).length, nB) : null
      }
    };
  }

  // ---------------------------------------------------------------- vaga

  var TERMOS = [
    ["JavaScript", /\bjavascript\b/i], ["TypeScript", /\btypescript\b/i], ["React", /\breact(\.js|js)?\b(?!\s*native)/i],
    ["React Native", /\breact native\b/i], ["Next.js", /\bnext\.?js\b/i], ["Vue", /\bvue(\.js|js)?\b/i], ["Nuxt", /\bnuxt/i],
    ["Angular", /\bangular(js)?\b/i], ["Svelte", /\bsvelte/i], ["Node.js", /\bnode(\.js|js)?\b/i], ["Express", /\bexpress(\.js|js)?\b/i],
    ["NestJS", /\bnest\.?js\b/i], ["PHP", /\bphp\b/i], ["Laravel", /\blaravel\b/i], ["Livewire", /\blivewire\b/i],
    ["Symfony", /\bsymfony\b/i], ["WordPress", /\bwordpress\b/i], ["Python", /\bpython\b/i], ["Django", /\bdjango\b/i],
    ["Flask", /\bflask\b/i], ["FastAPI", /\bfastapi\b/i], ["Java", /\bjava\b(?!\s*script)/i], ["Spring", /\bspring( boot)?\b/i],
    ["Kotlin", /\bkotlin\b/i], ["C#", /(^|[^a-z])c#/i], [".NET", /\.net\b|\bdotnet\b/i], ["Go", /\bgolang\b|(^|[\s,(\/])Go(?=[\s,)\/]|$)/],
    ["Ruby", /\bruby\b/i], ["Ruby on Rails", /\brails\b/i], ["Rust", /\brust\b/i], ["Swift", /\bswift\b/i], ["Flutter", /\bflutter\b/i],
    ["SQL", /\bsql\b/i], ["PostgreSQL", /\bpostgres(ql)?\b/i], ["MySQL", /\bmysql\b/i], ["MongoDB", /\bmongo(db)?\b/i],
    ["Redis", /\bredis\b/i], ["GraphQL", /\bgraphql\b/i], ["REST APIs", /\brestful\b|\brest\s*(api|apis|services|endpoints)\b/i],
    ["Docker", /\bdocker\b/i], ["Kubernetes", /\bkubernetes\b|\bk8s\b/i], ["AWS", /\baws\b|amazon web services/i],
    ["GCP", /\bgcp\b|google cloud/i], ["Azure", /\bazure\b/i], ["Terraform", /\bterraform\b/i],
    ["CI/CD", /\bci\s*\/\s*cd\b|continuous (integration|delivery|deployment)/i], ["GitHub Actions", /\bgithub actions\b/i],
    ["Git", /\bgit\b/i], ["Jest", /\bjest\b/i], ["Cypress", /\bcypress\b/i], ["Playwright", /\bplaywright\b/i], ["PHPUnit", /\bphpunit\b/i],
    ["Testes automatizados", /\b(unit|integration|automated|e2e|end-to-end)[- ]test(s|ing)?\b|\btdd\b/i],
    ["Microservices", /\bmicro-?services?\b/i], ["HTML", /\bhtml5?\b/i], ["CSS", /\bcss3?\b/i], ["Tailwind CSS", /\btailwind/i],
    ["Sass", /\bs[ac]ss\b/i], ["Redux", /\bredux\b/i], ["Linux", /\blinux\b/i], ["Agile/Scrum", /\bagile\b|\bscrum\b|\bkanban\b/i],
    ["Kafka", /\bkafka\b/i], ["RabbitMQ", /\brabbitmq\b/i], ["Elasticsearch", /\belastic ?search\b/i], ["Firebase", /\bfirebase\b/i],
    ["Supabase", /\bsupabase\b/i], ["Figma", /\bfigma\b/i], ["Vite", /\bvite\b/i], ["Webpack", /\bwebpack\b/i],
    ["OAuth/JWT", /\boauth\s*2?\b|\bjwt\b/i], ["Acessibilidade (a11y)", /\baccessibility\b|\ba11y\b|\bwcag\b/i],
    ["Observabilidade", /\bobservability\b|\bdatadog\b|\bsentry\b|\bgrafana\b|\bnew relic\b/i],
    ["IA / LLMs", /\bllms?\b|\bopenai\b|\bgenerative ai\b|\bai\b/i],
    ["Code review", /\bcode reviews?\b/i], ["Mentoria", /\bmentor(ing|ship)?\b/i],
    ["Comunicação assíncrona", /\basync(hronous)?\b|\bwritten communication\b/i]
  ];

  function compararVaga(textoCv, textoVaga) {
    textoCv = String(textoCv || "");
    textoVaga = String(textoVaga || "");
    var presentes = [];
    var faltando = [];
    TERMOS.forEach(function (t) {
      if (!t[1].test(textoVaga)) return;
      (t[1].test(textoCv) ? presentes : faltando).push(t[0]);
    });
    var total = presentes.length + faltando.length;
    var compat = total ? Math.round(presentes.length / total * 100) : null;

    var alertas = [];
    var positivos = [];
    var info = [];
    var neg = textoVaga.match(/\b(us|u\.s\.)[- ]only\b|must (be|reside|live) (located |based )?in the (us|u\.s\.|united states)|authori[sz]ed to work in the (us|u\.s\.|united states)|\bw-?2\b|security clearance|\bus citizens?(hip)?\b|green card|\b(eu|europe|uk)[- ]only\b|must be based in (europe|the uk|canada|the eu)/i);
    if (neg) alertas.push("Pode exigir residência ou autorização de trabalho fora do Brasil (“" + neg[0] + "”). Confirme antes de investir tempo.");
    var pos = textoVaga.match(/\b(latam|latin america|south america|brazil|brasil|anywhere|worldwide|work from anywhere|americas)\b/i);
    if (pos) positivos.push("Sinal de que aceita o Brasil/LATAM: “" + pos[0] + "”.");
    if (/\b(contractor|independent contractor|1099|deel|oyster|remote\.com)\b/i.test(textoVaga)) positivos.push("Menciona contrato de contractor/plataforma (compatível com PJ).");
    var anos = textoVaga.match(/(\d{1,2})\+?\s*(?:years?|yrs)\b/i);
    if (anos) info.push("Pede cerca de " + anos[1] + "+ anos de experiência.");
    if (/\b(fluent|excellent|strong)\b[^.]{0,40}\b(english|communication)\b/i.test(textoVaga)) info.push("Pede inglês/comunicação forte: espere entrevistas longas em inglês.");
    if (/\$\s?\d[\d,.]*\s?k?\s*(-|–|to)\s*\$?\s?\d/i.test(textoVaga)) info.push("Divulga faixa salarial.");
    if (/\b(overlap|time ?zone|est|pst|cst|et|pt)\b/i.test(textoVaga) && /\b(hours?|overlap|time ?zone)\b/i.test(textoVaga)) info.push("Menciona fuso/sobreposição de horário: confirme se UTC-3 encaixa.");

    return { compatibilidade: compat, nivel: nivel(compat), presentes: presentes, faltando: faltando, alertas: alertas, positivos: positivos, info: info, termosNaVaga: total };
  }

  // ---------------------------------------------------------------- inglês escrito (LanguageTool)

  var REGRAS_RUIDOSAS = ["WHITESPACE_RULE", "COMMA_PARENTHESIS_WHITESPACE", "EN_QUOTES", "DASH_RULE", "UPPERCASE_SENTENCE_START",
    "PUNCTUATION_PARAGRAPH_END", "EN_UNPAIRED_BRACKETS", "EN_UNPAIRED_QUOTES", "ENGLISH_WORD_REPEAT_BEGINNING_RULE",
    "CONSECUTIVE_SPACES", "MULTIPLICATION_SIGN", "PLUS_MINUS", "ARROWS", "DOUBLE_PUNCTUATION", "SENTENCE_WHITESPACE",
    "UNLIKELY_OPENING_PUNCTUATION", "EN_DIACRITICS_REPLACE", "PHRASE_REPETITION", "WORD_REPEAT_RULE"];

  var TECH_PALAVRAS = ("laravel livewire filament inertia vite supabase symfony eloquent nginx ubuntu devops frontend backend " +
    "fullstack monorepo webhook webhooks saas mvp api apis json jwt crud npm yarn pnpm nodejs reactjs vuejs nextjs nestjs " +
    "typescript javascript graphql postgresql postgres mysql mongodb redis docker kubernetes terraform phpunit jest cypress " +
    "playwright tailwind tailwindcss figma firebase webpack eslint prettier github gitlab bitbucket jira scrum kanban " +
    "microservices serverless middleware frontend backend dev devs ux ui css html sass scss oauth sql nosql repo repos " +
    "onboarding refactored refactoring dockerized containerized responsive linkedin").split(" ");

  function palavraDoMatch(m) {
    var c = m.context || {};
    return String(c.text || "").substr(c.offset || 0, c.length || 0);
  }

  function ehFalsoPositivo(m) {
    var regra = m.rule || {};
    if (REGRAS_RUIDOSAS.indexOf(regra.id) !== -1) return true;
    if (regra.category && regra.category.id === "TYPOGRAPHY") return true;
    if (/^MORFOLOGIK/.test(regra.id || "")) {
      var p = palavraDoMatch(m);
      if (!p) return false;
      if (/\d|[.#+_/@]/.test(p)) return true;
      if (/^[A-Z0-9]{2,}$/.test(p)) return true; // siglas
      if (/[a-z][A-Z]/.test(p)) return true; // camelCase
      if (TECH_PALAVRAS.indexOf(p.toLowerCase()) !== -1) return true;
      if (/^[A-Z]/.test(p) && !(m.replacements || []).length) return true; // nome próprio sem sugestão
    }
    return false;
  }

  function analisarEscrita(resposta) {
    var matches = (resposta.matches || []).filter(function (m) { return !ehFalsoPositivo(m); });
    var nPal = Math.max(resposta.palavras || palavras(resposta.textoEnviado).length, 1);
    var itens = matches.map(function (m) {
      var regra = m.rule || {};
      var cat = regra.category ? regra.category.id : "";
      var tipo = /^(STYLE|REDUNDANCY|PLAIN_ENGLISH|CASING)$/.test(cat) || regra.issueType === "style" ? "estilo"
        : /^MORFOLOGIK/.test(regra.id || "") ? "ortografia" : "gramática";
      var p = palavraDoMatch(m);
      return {
        tipo: tipo,
        trecho: p,
        contexto: (m.context && m.context.text) || "",
        mensagem: m.message || regra.description || "",
        sugestoes: (m.replacements || []).slice(0, 3).map(function (r) { return r.value; }),
        possivelNomeProprio: tipo === "ortografia" && /^[A-Z]/.test(p)
      };
    });
    var graves = itens.filter(function (i) { return i.tipo !== "estilo"; }).length;
    var estilo = itens.length - graves;
    // mínimo de 150 palavras no denominador: em textos curtos, poucos erros não devem zerar a nota
    var por100 = (graves + estilo * 0.3) / (Math.max(nPal, 150) / 100);
    var nota = Math.max(0, Math.min(100, Math.round(100 - por100 * 20)));
    return { pontuacao: nota, nivel: nivel(nota), itens: itens, graves: graves, estilo: estilo, palavras: nPal, por100: Math.round(por100 * 10) / 10 };
  }

  // ---------------------------------------------------------------- GitHub

  function analisarReadme(texto, repo) {
    texto = String(texto || "");
    var partes = {
      "descrição suficiente": texto.length >= 400,
      "prints ou GIF": /!\[[^\]]*\]\(|<img\s/i.test(texto),
      "como rodar": /(getting started|installation|install|setup|how to run|running locally|usage|npm (i|install|run)|yarn|pnpm|composer install|docker[ -]compose|docker compose|php artisan|pip install)/i.test(texto),
      "stack": /(tech(nology)? stack|built with|technologies|\bstack\b|tecnologias)/i.test(texto),
      "demo": Boolean(repo && repo.homepage) || /\b(demo|live)\b|vercel\.app|netlify\.app|github\.io|herokuapp|onrender\.com|\.pages\.dev|fly\.dev/i.test(texto),
      "decisões técnicas": /(architecture|arquitetura|decisions|decisões|trade-?offs|challenges|lessons learned|how it works)/i.test(texto),
      "em inglês": texto.length > 0 && detectarIdioma(texto) !== "pt"
    };
    var nomes = Object.keys(partes);
    var ok = nomes.filter(function (n) { return partes[n]; });
    return { completude: texto ? ok.length / nomes.length : 0, faltando: texto ? nomes.filter(function (n) { return !partes[n]; }) : ["README inteiro"] };
  }

  function analisarGithub(dados) {
    var u = dados.usuario || {};
    var repos = dados.repos || [];
    var readmes = dados.readmes || {};
    var hoje = dados.agora ? new Date(dados.agora) : new Date();
    var proprios = repos.filter(function (r) { return !r.fork && !r.archived; });
    var forks = repos.filter(function (r) { return r.fork; });
    var top = proprios.slice().sort(function (a, b) {
      return (b.stargazers_count - a.stargazers_count) || (new Date(b.pushed_at) - new Date(a.pushed_at));
    }).slice(0, 6);
    var checks = [];
    function add(c) { checks.push(c); }

    var bioPt = u.bio && detectarIdioma(u.bio + " " + u.bio) === "pt";
    add({ id: "gh-bio", peso: 1, status: !u.bio ? "aviso" : bioPt ? "aviso" : "ok", titulo: "Bio do perfil",
      detalhe: !u.bio ? "O perfil não tem bio." : bioPt ? "A bio está em português." : "Bio: “" + resumirTexto(u.bio, 100) + "”.",
      acao: !u.bio || bioPt ? "Escreva em inglês: cargo + stack + o que você constrói. Ex.: “Full-stack developer (Laravel, React) building tools for small businesses.”" : "" });
    add({ id: "gh-nome-local", peso: 0.5, status: u.name && u.location ? "ok" : "aviso", titulo: "Nome e localização",
      detalhe: (u.name ? "Nome preenchido" : "Sem nome") + "; " + (u.location ? "local: " + u.location : "sem localização") + ".",
      acao: u.name && u.location ? "" : "Preencha nome completo e localização (ex.: “Brazil · Remote”)." });
    add({ id: "gh-site", peso: 0.5, status: u.blog ? "ok" : "aviso", titulo: "Link para portfólio ou LinkedIn",
      detalhe: u.blog ? "Link: " + u.blog : "O campo de site está vazio.", acao: u.blog ? "" : "Coloque o link do LinkedIn ou portfólio no campo Website." });
    add({ id: "gh-readme-perfil", peso: 1.5, status: dados.temReadmePerfil ? "ok" : "aviso", titulo: "README de perfil",
      detalhe: dados.temReadmePerfil ? "Tem README de perfil." : "Não tem o repositório " + (u.login || "usuario") + "/" + (u.login || "usuario") + " com README.",
      acao: dados.temReadmePerfil ? "" : "Crie um repositório com o mesmo nome do usuário e um README curto em inglês: quem você é, stack, 2–3 projetos com links e como contatar." });
    add({ id: "gh-repos", peso: 2, status: proprios.length >= 4 ? "ok" : proprios.length >= 1 ? "aviso" : "critico", titulo: "Projetos próprios públicos",
      detalhe: proprios.length + " repositório(s) próprio(s) público(s)" + (forks.length ? " e " + forks.length + " fork(s)" : "") + ".",
      acao: proprios.length >= 4 ? "" : "Tenha pelo menos 2–3 projetos próprios bem acabados (qualidade importa mais que quantidade)." });

    var ultimo = proprios.reduce(function (max, r) { var d = new Date(r.pushed_at); return d > max ? d : max; }, new Date(0));
    var dias = proprios.length ? Math.round((hoje - ultimo) / 86400000) : null;
    add({ id: "gh-atividade", peso: 1.5, status: dias === null ? "critico" : dias <= 30 ? "ok" : dias <= 120 ? "aviso" : "critico", titulo: "Atividade recente",
      detalhe: dias === null ? "Sem repositórios próprios." : "Último push em projeto próprio há " + dias + " dia(s).",
      acao: dias !== null && dias <= 30 ? "" : "Faça commits regulares em um projeto de destaque (melhorias pequenas contam)." });

    if (top.length) {
      var comDesc = top.filter(function (r) { return r.description; }).length;
      add({ id: "gh-descricoes", peso: 1, status: comDesc === top.length ? "ok" : comDesc >= top.length / 2 ? "aviso" : "critico", titulo: "Descrição nos repositórios",
        detalhe: comDesc + " de " + top.length + " projetos principais têm descrição.", acao: comDesc === top.length ? "" : "Escreva 1 linha em inglês no “About” de cada repositório: o que é e para quem." });

      var readmeInfo = top.slice(0, 4).map(function (r) {
        var a = analisarReadme(readmes[r.name], r);
        return { repo: r.name, completude: a.completude, faltando: a.faltando, temDemo: a.faltando.indexOf("demo") === -1 };
      });
      var media = readmeInfo.reduce(function (s, i) { return s + i.completude; }, 0) / readmeInfo.length;
      add({ id: "gh-readmes", peso: 3, status: media >= 0.75 ? "ok" : media >= 0.4 ? "aviso" : "critico", titulo: "READMEs dos projetos principais",
        detalhe: "Completude média: " + Math.round(media * 100) + "%. " + readmeInfo.map(function (i) {
          return i.repo + (i.faltando.length ? " (falta: " + i.faltando.join(", ") + ")" : " (completo)");
        }).join("; ") + ".",
        acao: media >= 0.75 ? "" : "Para cada projeto: o que é, demo, prints, stack, como rodar e decisões técnicas — em inglês.",
        detalheRepos: readmeInfo });

      var temDemo = readmeInfo.some(function (i) { return i.temDemo; }) || top.some(function (r) { return r.homepage; });
      add({ id: "gh-demo", peso: 1.5, status: temDemo ? "ok" : "aviso", titulo: "Demo online",
        detalhe: temDemo ? "Pelo menos um projeto tem demo." : "Nenhum projeto principal tem link de demo.",
        acao: temDemo ? "" : "Publique uma demo do seu melhor projeto (Vercel, Netlify, Render e similares têm planos gratuitos) e coloque o link no README e no “About”." });

      var temTopics = top.some(function (r) { return r.topics && r.topics.length; });
      add({ id: "gh-topics", peso: 0.5, status: temTopics ? "ok" : "aviso", titulo: "Topics nos repositórios",
        detalhe: temTopics ? "Há repositórios com topics." : "Nenhum projeto principal tem topics.", acao: temTopics ? "" : "Adicione topics (laravel, react, api…) para facilitar a busca." });
    }

    if (forks.length > proprios.length && forks.length > 3) {
      add({ id: "gh-forks", peso: 0.5, status: "aviso", titulo: "Forks escondem seus projetos",
        detalhe: "Há mais forks (" + forks.length + ") do que projetos próprios.", acao: "Arquive ou apague forks sem contribuição sua e fixe (Pin) seus melhores projetos." });
    }
    add({ id: "gh-fixados", peso: 0, status: "info", titulo: "Projetos fixados",
      detalhe: "A API pública não mostra os projetos fixados.", acao: "Confira se os 4–6 projetos fixados no perfil são os melhores e mais recentes." });

    var nota = pontuar(checks);
    return { pontuacao: nota, nivel: nivel(nota), checks: checks, usuario: u.login, perfil: u.html_url, top: top.map(function (r) { return r.name; }) };
  }

  // ---------------------------------------------------------------- autoavaliação

  function num(v) {
    if (v === "" || v === null || v === undefined) return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  var AREAS_AUTO = [
    { id: "objetivo", nome: "Clareza do objetivo", campos: ["role", "market", "level"], texto: true },
    { id: "curriculo", nome: "Currículo / perfil", campos: ["resumeCurrent", "resumeTargeted", "resumeEvidence"] },
    { id: "portfolio", nome: "Projetos / presença", campos: ["portfolioRelevant", "portfolioExplained", "portfolioDemo"] },
    { id: "idioma", nome: "Inglês (percepção)", campos: ["languageSpeaking", "languageWriting"] },
    { id: "entrevistas", nome: "Entrevistas", campos: ["interviewExamples", "interviewTechnical", "interviewPractice"] }
  ];

  // Nota de cada área da autoavaliação: média dos itens respondidos (sim = 100, em parte = 50, não = 0).
  // O objetivo é pontuado pela quantidade de campos definidos. Área sem resposta = null.
  function pontuarAutoavaliacao(f) {
    f = f || {};
    return AREAS_AUTO.map(function (a) {
      var nota;
      if (a.texto) {
        var definidos = a.campos.filter(function (c) { return String(f[c] || "").trim(); }).length;
        nota = definidos ? Math.round(definidos / a.campos.length * 100) : null;
      } else {
        var vals = a.campos.map(function (c) { return num(f[c]); }).filter(function (v) { return v !== null; });
        nota = vals.length ? Math.round(vals.reduce(function (s, v) { return s + v; }, 0) / vals.length * 100) : null;
      }
      return { id: a.id, nome: a.nome, nota: nota };
    });
  }

  function temAutoavaliacao(f) {
    if (!f) return false;
    return Object.keys(f).some(function (k) { return k !== "name" && String(f[k] || "").trim(); });
  }

  // ---------------------------------------------------------------- plano de ação

  function gerarPlano(ctx) {
    var f = ctx.form || null;
    var cv = ctx.curriculo || null;
    var vaga = ctx.vaga || null;
    var esc = ctx.escrita && !ctx.escrita.pulado ? ctx.escrita : null;
    var gh = ctx.github || null;
    var acoes = [];
    var usados = {};

    function add(a) { acoes.push(a); }
    function check(analise, id) {
      if (!analise) return null;
      for (var i = 0; i < analise.checks.length; i++) if (analise.checks[i].id === id) return analise.checks[i];
      return null;
    }

    var fala = f ? num(f.languageSpeaking) : null;
    var escrita = f ? num(f.languageWriting) : null;

    // --- objetivo
    if (f && !String(f.role || "").trim()) {
      add({ prioridade: 1, area: "Objetivo", tipo: "autoavaliacao", titulo: "Definir a vaga-alvo",
        porque: "Sem um cargo-alvo, currículo, LinkedIn e projetos ficam genéricos e não passam no filtro de palavras-chave.",
        passos: ["Escolha 1 cargo principal (ex.: Full-stack Developer) e 1 alternativo.", "Leia 10 vagas desse cargo e anote as 10 tecnologias que mais aparecem.", "Use essas palavras no Summary e em Skills (só as que você domina)."] });
    }

    // --- inglês falado
    if (f && fala === null) {
      add({ prioridade: 2, area: "Inglês falado", tipo: "autoavaliacao", titulo: "Medir seu nível de inglês",
        porque: "Você não estimou seu inglês falado, e ele é o primeiro filtro: a call com o recrutador é em inglês.",
        passos: ["Faça o EF SET (gratuito, cerca de 50 min, efset.org) e anote o nível CEFR.", "Grave 1 minuto respondendo “Tell me about yourself” e ouça: onde você trava?"] });
    } else if (fala !== null && fala <= 0.25) {
      add({ prioridade: 1, area: "Inglês falado", tipo: "autoavaliacao", titulo: "Construir base de conversação em inglês",
        porque: "Você relatou dificuldade em conversas de trabalho. Entrevistas para vagas internacionais são ao vivo, em inglês, com perguntas de acompanhamento.",
        passos: ["3 sessões por semana de 30 min focadas em conversação (aula com professor ou tutor online).", "Shadowing diário de 10 min: repita em voz alta trechos de talks técnicas ou podcasts de devs.", "Refaça o EF SET em 8 semanas para medir a evolução."] });
    } else if (fala === 0.5) {
      add({ prioridade: 1, area: "Inglês falado", tipo: "autoavaliacao", titulo: "Praticar inglês falado com nativos, em situações de trabalho",
        porque: "Você dá conta do rotineiro, mas entrevista exige explicar decisões técnicas e improvisar respostas.",
        passos: ["2 conversas por semana com nativos ou fluentes: apps de troca de idiomas (como Tandem e HelloTalk) são gratuitos; tutores (como italki e Cambly) são pagos e mais focados.", "Leve roteiros de trabalho para essas conversas: apresentar seu projeto, explicar um bug, discordar com educação.", "Grave uma resposta por semana e compare com a da semana anterior."] });
    } else if (fala === 0.75) {
      add({ prioridade: 2, area: "Inglês falado", tipo: "autoavaliacao", titulo: "Treinar inglês sob pressão de entrevista",
        porque: "Você trabalha com conforto em inglês; o próximo nível é responder bem sem preparo, com nervosismo.",
        passos: ["1 simulação de entrevista por semana com alguém fluente, sem roteiro.", "Pratique os 3 primeiros minutos (small talk + “tell me about yourself”) até sair natural."] });
    }

    // --- inglês escrito
    if (esc && esc.pontuacao < 60) {
      add({ prioridade: 1, area: "Inglês escrito", tipo: escrita !== null && escrita >= 0.75 ? "divergencia" : "evidencia", titulo: "Corrigir o inglês do currículo",
        porque: (escrita !== null && escrita >= 0.75 ? "Você avaliou sua escrita como confortável, mas o " : "O ") + "LanguageTool encontrou " + esc.graves + " problema(s) de gramática/ortografia (" + esc.por100 + " por 100 palavras). Erros no currículo são lidos como falta de cuidado.",
        passos: ["Corrija os itens listados na seção “Inglês escrito” abaixo.", "Peça para alguém fluente revisar a versão final antes de aplicar."] });
    }
    if (escrita !== null && escrita <= 0.5) {
      add({ prioridade: 2, area: "Inglês escrito", tipo: "autoavaliacao", titulo: "Escrever em inglês todo dia",
        porque: "Em trabalho remoto, a maior parte da comunicação é escrita (Slack, PRs, documentação).",
        passos: ["Escreva sua daily em inglês: o que fez, o que vai fazer, bloqueios (5 linhas por dia).", "Faça commits, PRs e READMEs dos seus projetos em inglês.", "Passe textos importantes por um corretor (ex.: LanguageTool) antes de enviar."] });
    }

    // --- currículo
    if (cv) {
      var met = check(cv, "metricas");
      if (f && num(f.resumeEvidence) === 1 && cv.stats.comMetricaPct !== null && cv.stats.comMetricaPct < 40) {
        usados.metricas = true;
        add({ prioridade: 1, area: "Currículo", tipo: "divergencia", titulo: "Mostrar resultados com números",
          porque: "Você marcou que o currículo mostra resultados, mas só " + cv.stats.comMetricaPct + "% dos bullets têm números ou impacto mensurável. Para um recrutador, sem número parece lista de tarefas.",
          passos: ["Para cada bullet, pergunte: quanto? quantos? quão mais rápido? Fórmula: verbo + o que fez + resultado.", "Se o número for estimativa, seja conservador e esteja pronto para explicar como chegou nele."],
          exemplos: met && met.exemplos });
      }
      var criticos = cv.checks.filter(function (c) { return c.status === "critico" && !usados[c.id]; });
      criticos.slice(0, 3).forEach(function (c) {
        usados[c.id] = true;
        add({ prioridade: 1, area: "Currículo", tipo: "evidencia", titulo: c.titulo, porque: c.detalhe, passos: [c.acao], exemplos: c.exemplos });
      });
      var avisos = cv.checks.filter(function (c) { return (c.status === "aviso" || (c.status === "critico" && !usados[c.id])) && c.acao; });
      if (avisos.length) {
        add({ prioridade: 2, area: "Currículo", tipo: "evidencia", titulo: "Ajustes finos no currículo (" + avisos.length + ")",
          porque: "Pontos que não eliminam sozinhos, mas somados fazem o currículo parecer menos profissional.",
          passos: avisos.slice(0, 6).map(function (c) { return c.titulo + ": " + c.acao; }) });
      }
    }
    if (f && num(f.resumeTargeted) !== null && num(f.resumeTargeted) < 1) {
      add({ prioridade: 2, area: "Currículo", tipo: "autoavaliacao", titulo: "Adaptar o currículo a cada vaga",
        porque: "Recrutadores e ATS filtram por palavras-chave da vaga. Um currículo genérico perde para um ajustado.",
        passos: (vaga ? [] : ["Cole a descrição de uma vaga real no campo “Vaga” desta página e veja as palavras-chave que faltam."]).concat(["Mantenha um currículo base e ajuste só Summary e Skills para cada vaga (10 min por candidatura)."]) });
    }

    // --- vaga
    if (vaga) {
      if (vaga.alertas.length) {
        add({ prioridade: 1, area: "Vaga", tipo: "evidencia", titulo: "Esta vaga pode não aceitar candidatos do Brasil",
          porque: vaga.alertas.join(" "), passos: ["Pergunte ao recrutador antes de aplicar: “Is this role open to contractors based in Brazil?”"] });
      }
      if (vaga.compatibilidade !== null && vaga.compatibilidade < 75) {
        add({ prioridade: 2, area: "Vaga", tipo: "evidencia",
          titulo: vaga.compatibilidade < 50 ? "Esta vaga está distante do seu currículo hoje" : "Adaptar o currículo para esta vaga",
          porque: "O currículo cobre " + vaga.compatibilidade + "% das tecnologias citadas na vaga. Faltam: " + vaga.faltando.join(", ") + ".",
          passos: ["Das que faltam, adicione só as que você já usou de verdade: em Skills e em um bullet com contexto.", vaga.compatibilidade < 50 ? "Se você não domina metade das principais, priorize vagas mais próximas do seu perfil." : "Repita os termos exatamente como aparecem na vaga (ex.: “PostgreSQL”, não só “banco de dados”)."] });
      }
    }

    // --- portfólio / GitHub
    if (gh) {
      var readmes = check(gh, "gh-readmes");
      var demo = check(gh, "gh-demo");
      if (f && num(f.portfolioDemo) === 1 && demo && demo.status !== "ok") {
        usados["gh-demo"] = true;
        add({ prioridade: 2, area: "GitHub", tipo: "divergencia", titulo: "Publicar uma demo do seu melhor projeto",
          porque: "Você marcou que é fácil ver e testar seus projetos, mas nenhum dos principais repositórios tem link de demo.",
          passos: [demo.acao] });
      }
      if (f && num(f.portfolioExplained) === 1 && readmes && readmes.status !== "ok") {
        usados["gh-readmes"] = true;
        add({ prioridade: 2, area: "GitHub", tipo: "divergencia", titulo: "Completar os READMEs",
          porque: "Você marcou que seus projetos explicam problema, contribuição e tecnologias, mas os READMEs estão incompletos: " + readmes.detalhe,
          passos: [readmes.acao] });
      }
      var ghProblemas = gh.checks.filter(function (c) { return (c.status === "critico" || c.status === "aviso") && c.acao && !usados[c.id]; });
      ghProblemas.sort(function (a, b) { return (a.status === "critico" ? 0 : 1) - (b.status === "critico" ? 0 : 1) || b.peso - a.peso; });
      if (ghProblemas.length) {
        add({ prioridade: ghProblemas[0].status === "critico" ? 1 : 2, area: "GitHub", tipo: "evidencia", titulo: "Melhorar o GitHub para a visita de 2 minutos de um tech lead",
          porque: ghProblemas.slice(0, 5).map(function (c) { return c.titulo + ": " + c.detalhe; }).join(" "),
          passos: ghProblemas.slice(0, 5).map(function (c) { return c.acao; }) });
      }
    }
    if (f && num(f.portfolioRelevant) === 0) {
      add({ prioridade: 1, area: "Portfólio", tipo: "autoavaliacao", titulo: "Construir um projeto de destaque",
        porque: "Sem um projeto para mostrar, sua experiência fica só na palavra. Para quem é de fora dos EUA, o portfólio é a prova mais rápida.",
        passos: ["Escolha um problema real (seu ou de alguém próximo) e construa uma versão pequena e completa em 3–4 semanas.", "README em inglês: o que é, demo, prints, stack, como rodar e decisões técnicas.", "Publique uma demo online e coloque o link no currículo e no LinkedIn."] });
    }

    // --- entrevistas
    var pratica = f ? num(f.interviewPractice) : null;
    if (pratica === 0) {
      add({ prioridade: 1, area: "Entrevistas", tipo: "autoavaliacao", titulo: "Treinar entrevistas em voz alta toda semana",
        porque: "Você quase nunca pratica respostas em voz alta. Saber a resposta e conseguir falá-la em inglês, sob pressão, são coisas diferentes.",
        passos: ["1 simulação por semana (com um amigo, com IA ou com nativos), gravando o áudio.", "Comece pelo “Tell me about yourself” de 1 minuto até falar sem ler.", "Depois de cada simulação, anote 3 frases em que travou e reescreva-as."] });
    } else if (pratica === 0.5) {
      add({ prioridade: 2, area: "Entrevistas", tipo: "autoavaliacao", titulo: "Transformar a prática ocasional em rotina",
        porque: "Prática ocasional não cria fluência de resposta; a regularidade é o que faz diferença.", passos: ["Agende 1 simulação fixa por semana e grave.", "Alterne: uma semana comportamental, outra técnica."] });
    }
    if (f && num(f.interviewExamples) !== null && num(f.interviewExamples) < 1) {
      add({ prioridade: 2, area: "Entrevistas", tipo: "autoavaliacao", titulo: "Montar seu banco de histórias STAR",
        porque: "Perguntas comportamentais (“Tell me about a time…”) pesam muito em empresas americanas e pedem exemplos reais, com resultado.",
        passos: ["Escreva 6 histórias reais: um conflito, um erro, um prazo apertado, uma liderança, algo que aprendeu rápido e um orgulho técnico.", "Formato STAR: Situação, Tarefa, Ação (o que VOCÊ fez) e Resultado (com número, se houver).", "Ensaie cada uma em inglês em até 2 minutos."] });
    }
    if (f && num(f.interviewTechnical) !== null && num(f.interviewTechnical) < 1) {
      add({ prioridade: 2, area: "Entrevistas", tipo: "autoavaliacao", titulo: "Explicar um projeto técnico em 2 minutos",
        porque: "Tech leads querem entender suas decisões, não só a stack.",
        passos: ["Escolha seu melhor projeto e prepare: problema, arquitetura, uma decisão difícil e o que faria diferente.", "Grave em inglês e corte até caber em 2 minutos."] });
    }

    if (!f) {
      add({ prioridade: 2, area: "Autoavaliação", tipo: "autoavaliacao", titulo: "Preencher a autoavaliação",
        porque: "Sem ela, o plano não considera inglês falado e preparo para entrevistas, que são os maiores filtros depois do currículo.",
        passos: ["Responda as perguntas da seção “Sua autoavaliação” nesta página (5 min) e gere o diagnóstico de novo."] });
    }

    var ordemTipo = { divergencia: 0, evidencia: 1, autoavaliacao: 2 };
    acoes.sort(function (a, b) { return a.prioridade - b.prioridade || ordemTipo[a.tipo] - ordemTipo[b.tipo]; });
    return acoes;
  }

  return {
    analisarCurriculo: analisarCurriculo,
    compararVaga: compararVaga,
    analisarEscrita: analisarEscrita,
    analisarGithub: analisarGithub,
    gerarPlano: gerarPlano,
    pontuarAutoavaliacao: pontuarAutoavaliacao,
    temAutoavaliacao: temAutoavaliacao,
    detectarIdioma: detectarIdioma,
    ehVerboDeAcao: ehVerboDeAcao,
    extrairGithub: extrairGithub,
    nivel: nivel,
    _interno: { analisarReadme: analisarReadme, temMetrica: temMetrica, detectarSecao: detectarSecao }
  };
}));
