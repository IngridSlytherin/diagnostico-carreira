// Rodar com: node --test testes/
const test = require("node:test");
const assert = require("node:assert");
const R = require("../js/regras.js");

const CV_BOM = `Jane Doe
Full-Stack Developer · São Paulo, Brazil · Remote (UTC-3)
jane@example.com · linkedin.com/in/janedoe · github.com/janedoe

Summary
Full-stack developer with 5 years of experience building Laravel and React applications for SaaS companies. Reduced infrastructure costs by 30% and shipped features used by 20,000 monthly users.

Experience
Senior Developer, Acme Corp — Jan 2021 – Present
• Built a billing API in Laravel that processes 15,000 invoices per month.
• Reduced page load time by 40% by adding Redis caching and query optimization.
• Led the migration from Vue 2 to React, cutting bundle size by 35%.
• Mentored 3 junior developers through weekly code reviews.
Developer, Beta Ltd — Mar 2019 – Dec 2020
• Developed 12 REST endpoints consumed by the mobile app.
• Automated deployments with GitHub Actions, reducing release time from 2 hours to 15 minutes.

Skills
PHP, Laravel, JavaScript, TypeScript, React, MySQL, Redis, Docker, Git

Education
B.Sc. in Computer Science — University of São Paulo, 2018

Languages
Portuguese: Native · English: Advanced (C1)`;

const CV_FRACO = `JOÃO SILVA
Data de nascimento: 01/01/1995 · Estado civil: solteiro
joao@email.com · (11) 91234-5678

Objetivo
Sou um desenvolvedor hard-working e passionate, team player.

Experience
Desenvolvedor na Empresa X
- Responsible for the maintenance of the system.
- Worked on several projects using PHP.
- I helped the team with bugs.
- Participated in meetings with clients.

Skills
PHP, HTML, CSS`;

const VAGA = `We are hiring a Senior Full-Stack Engineer (Laravel + React). Fully remote, open to candidates in LATAM.
Requirements: 5+ years with PHP and Laravel, React and TypeScript, PostgreSQL, Docker, AWS, CI/CD.
Independent contractor via Deel. Excellent written English communication.`;

test("currículo forte tira nota alta e não tem críticos", () => {
  const r = R.analisarCurriculo(CV_BOM, { paginas: 1 });
  const criticos = r.checks.filter((c) => c.status === "critico").map((c) => c.id);
  assert.deepStrictEqual(criticos, []);
  assert.ok(r.pontuacao >= 90, "nota " + r.pontuacao);
  assert.strictEqual(r.github, "janedoe");
  assert.strictEqual(r.stats.idioma, "en");
  assert.strictEqual(r.stats.comVerboPct, 100);
  assert.ok(r.stats.comMetricaPct >= 80);
});

test("currículo fraco aponta dados pessoais, frases fracas, métricas e idioma", () => {
  const r = R.analisarCurriculo(CV_FRACO, {});
  const st = Object.fromEntries(r.checks.map((c) => [c.id, c.status]));
  assert.strictEqual(st["dados-pessoais"], "critico");
  assert.strictEqual(st["frases-fracas"], "critico");
  assert.strictEqual(st["metricas"], "critico");
  assert.notStrictEqual(st["idioma"], "ok");
  assert.strictEqual(st["cliches"], "critico");
  assert.strictEqual(st["pronomes"], "aviso");
  assert.strictEqual(st["telefone"], "aviso");
  assert.ok(r.pontuacao < 50, "nota " + r.pontuacao);
});

test("PDF sem texto (imagem) é crítico", () => {
  const r = R.analisarCurriculo("Jane", { paginas: 1 });
  assert.strictEqual(r.pontuacao, 0);
  assert.strictEqual(r.checks[0].id, "texto-extraivel");
});

test("verbos de ação: passado, presente, gerúndio e falsos", () => {
  ["Built", "build", "Shipping", "Reduced", "optimizes", "Led", "Creating"].forEach((v) => assert.ok(R.ehVerboDeAcao(v), v));
  ["Experienced", "The", "Senior", "Responsible"].forEach((v) => assert.ok(!R.ehVerboDeAcao(v), v));
});

test("comparação com vaga encontra faltantes e sinais", () => {
  const v = R.compararVaga(CV_BOM, VAGA);
  assert.ok(v.faltando.includes("PostgreSQL"));
  assert.ok(v.faltando.includes("AWS"));
  assert.ok(v.presentes.includes("Laravel"));
  assert.ok(!v.presentes.includes("Java"), "Java não deve casar com JavaScript");
  assert.ok(v.positivos.length >= 2);
  assert.deepStrictEqual(v.alertas, []);
  const us = R.compararVaga(CV_BOM, "Must be authorized to work in the US. React developer.");
  assert.strictEqual(us.alertas.length, 1);
});

test("escrita: filtra falsos positivos de tecnologia", () => {
  const resp = {
    palavras: 100,
    matches: [
      { message: "Spelling", replacements: [{ value: "developed" }], context: { text: "I developped it", offset: 2, length: 10 }, rule: { id: "MORFOLOGIK_RULE_EN_US", issueType: "misspelling", category: { id: "TYPOS" } } },
      { message: "Spelling", replacements: [{ value: "Laravel" }], context: { text: "using laravel daily", offset: 6, length: 7 }, rule: { id: "MORFOLOGIK_RULE_EN_US", issueType: "misspelling", category: { id: "TYPOS" } } },
      { message: "Spelling", replacements: [], context: { text: "using NestJS daily", offset: 6, length: 6 }, rule: { id: "MORFOLOGIK_RULE_EN_US", issueType: "misspelling", category: { id: "TYPOS" } } },
      { message: "ws", replacements: [], context: { text: "a  b", offset: 1, length: 2 }, rule: { id: "WHITESPACE_RULE", category: { id: "TYPOGRAPHY" } } }
    ]
  };
  const e = R.analisarEscrita(resp);
  assert.strictEqual(e.itens.length, 1);
  assert.strictEqual(e.graves, 1);
  assert.strictEqual(e.pontuacao, 87); // 1 erro / 150 palavras (mínimo) → 100 − 20 × 0,67
});

test("GitHub: perfil vazio vs. perfil bom", () => {
  const agora = "2026-11-09T00:00:00Z";
  const vazio = R.analisarGithub({ usuario: { login: "x" }, repos: [], readmes: {}, temReadmePerfil: false, agora });
  assert.ok(vazio.pontuacao < 30, "vazio " + vazio.pontuacao);

  const repo = (n, extra) => Object.assign({ name: n, fork: false, archived: false, stargazers_count: 2, pushed_at: "2026-11-01T00:00:00Z", description: "A tool", homepage: "", topics: ["laravel"] }, extra);
  const readme = "# App\n\nA billing tool for freelancers. ".repeat(12) + "\n![screenshot](s.png)\n## Tech stack\nLaravel\n## Getting started\ncomposer install\n## Demo\nhttps://app.vercel.app\n## Architecture decisions\nWhy queues.";
  const bom = R.analisarGithub({
    usuario: { login: "jane", name: "Jane", bio: "Full-stack developer building tools with Laravel and React", location: "Brazil", blog: "linkedin.com/in/jane" },
    repos: [repo("a"), repo("b"), repo("c"), repo("d")],
    readmes: { a: readme, b: readme, c: readme, d: readme },
    temReadmePerfil: true, agora
  });
  assert.ok(bom.pontuacao >= 90, "bom " + bom.pontuacao);
});

test("plano: cruza autoavaliação com evidências", () => {
  const cv = R.analisarCurriculo(CV_FRACO, {});
  const form = { role: "Backend Developer", languageSpeaking: "0.5", languageWriting: "1", resumeEvidence: "1", interviewPractice: "0", interviewExamples: "0.5" };
  const escrita = { pontuacao: 40, graves: 6, por100: 3, itens: [] };
  const plano = R.gerarPlano({ curriculo: cv, form, escrita });
  const titulos = plano.map((a) => a.titulo);
  assert.ok(titulos.includes("Mostrar resultados com números"));
  assert.ok(titulos.some((t) => /nativos/.test(t)));
  assert.ok(titulos.includes("Treinar entrevistas em voz alta toda semana"));
  assert.ok(titulos.includes("Montar seu banco de histórias STAR"));
  const div = plano.filter((a) => a.tipo === "divergencia").map((a) => a.titulo);
  assert.ok(div.includes("Corrigir o inglês do currículo"), "escrita autoavaliada alta + LT ruim = divergência");
  // métrica não pode aparecer duas vezes (divergência + crítico)
  assert.strictEqual(plano.filter((a) => a.titulo === "Resultados com números").length, 0);
  // prioridades ordenadas
  for (let i = 1; i < plano.length; i++) assert.ok(plano[i - 1].prioridade <= plano[i].prioridade);
});

// ---------------------------------------------------------------- casos encontrados nos testes com PDF

test("idade: '29 anos' é dado pessoal, '10 anos de experiência' não", () => {
  const st = (t) => R.analisarCurriculo(t, {}).checks.find((c) => c.id === "dados-pessoais").status;
  assert.strictEqual(st("Bruno\nBrasileiro, casado, 29 anos\nbruno@x.com"), "critico");
  assert.strictEqual(st("Developer with 10 anos de experiência\nbruno@x.com"), "ok");
  assert.strictEqual(st("Developer with 10 years of experience\nbruno@x.com"), "ok");
});

test("títulos em português são reconhecidos como seções, mas o idioma é apontado", () => {
  const r = R.analisarCurriculo("Bruno\nbruno@x.com\nExperiência Profissional\nResponsável pela manutenção dos sites dos clientes da agência.\nDesenvolvimento de novas funcionalidades em WordPress e Laravel.\nParticipação em reuniões com clientes para levantamento de requisitos.\nFormação Acadêmica\nADS, 2019\nHabilidades\nPHP", {});
  assert.ok(r.stats.secoes.includes("experience"));
  assert.ok(r.stats.secoes.includes("education"));
  assert.strictEqual(r.stats.bullets, 3, "bullets sem marcador deveriam ser inferidos da seção");
  assert.notStrictEqual(r.checks.find((c) => c.id === "idioma").status, "ok");
  assert.ok(r.pontuacao <= 39, "português deveria limitar a nota a 39, deu " + r.pontuacao);
});

test("bullets de Word (símbolo \uf0b7) e bullet quebrado em duas linhas", () => {
  const r = R.analisarCurriculo("Experience\n\uf0b7 Built a billing API that processes 15,000 invoices\nper month for 40 clients.\n\uf0b7 Reduced costs by 20%.\n\uf0b7 Led a team of 4 developers.\nSkills\nPHP", {});
  assert.strictEqual(r.stats.bullets, 3);
  assert.ok(!r.checks.some((c) => c.id === "icones"), "símbolo de bullet do Word não é ícone");
});

test("teto: falhas eliminatórias limitam a nota e dizem por quê", () => {
  const base = "Jane\njane@x.com · linkedin.com/in/jane · github.com/jane · Brazil\nSummary\nDeveloper with 5 years building Laravel apps for 20 SaaS clients across Latin America and the US.\nExperience\nDev, Acme — Jan 2021 – Present\n";
  const bullets = [
    "- Built a billing API in Laravel that processes 15,000 invoices per month for small businesses.",
    "- Reduced page load time by 40% by adding Redis caching and rewriting slow database queries.",
    "- Led the migration from Vue 2 to React, cutting the bundle size by 35% in three months.",
    "- Mentored 3 junior developers through weekly pairing sessions and detailed code reviews.",
    "- Automated deployments with GitHub Actions, reducing release time from 2 hours to 15 minutes.",
    "- Wrote 300 PHPUnit tests that raised coverage from 20% to 75% across the payment modules.",
    "- Designed a multi-tenant permissions model adopted by 120 customer accounts in the first year.",
    "- Integrated Stripe and PayPal checkout flows that processed $40,000 in the first six months."
  ].join("\n");
  const fim = "\nSkills\nPHP\nEducation\nBSc, 2018\nLanguages\nEnglish: Advanced (C1)";
  const limpo = R.analisarCurriculo(base + bullets + fim, { paginas: 1 });
  assert.deepStrictEqual(limpo.limitadaPor, []);
  const colunas = R.analisarCurriculo(base + bullets + fim, { paginas: 1, colunas: true });
  assert.ok(colunas.pontuacao <= 74);
  assert.strictEqual(colunas.limitadaPor.length, 1);
  const repetido = R.analisarCurriculo(base + bullets + "\n" + bullets + fim, { paginas: 1 });
  assert.ok(repetido.pontuacao <= 59);
  assert.ok(repetido.checks.some((c) => c.id === "repetidos" && c.status === "critico"));
});

test("anonimização antes do LanguageTool", () => {
  require("../js/integracoes.js");
  const a = globalThis.Integracoes.anonimizar("Jane Doe\njane@x.com · +55 11 91234-5678 · linkedin.com/in/jane\nBuilt APIs in ASP.NET and Node.js, 2019 - 2021.");
  assert.ok(!/Jane Doe|jane@x|91234|linkedin/.test(a), a);
  assert.match(a, /ASP\.NET and Node\.js, 2019 - 2021/, "não pode apagar tecnologias nem datas");
});

test("autoavaliação: notas por área e áreas sem resposta", () => {
  const a = R.pontuarAutoavaliacao({ role: "Dev", market: "", level: "Júnior", resumeCurrent: "1", resumeTargeted: "0", resumeEvidence: "", languageSpeaking: "0.5" });
  const n = Object.fromEntries(a.map((x) => [x.id, x.nota]));
  assert.strictEqual(n.objetivo, 67);
  assert.strictEqual(n.curriculo, 50);
  assert.strictEqual(n.idioma, 50);
  assert.strictEqual(n.portfolio, null);
  assert.ok(!R.temAutoavaliacao({ name: "Ana" }), "só o nome não conta como autoavaliação");
  assert.ok(R.temAutoavaliacao({ name: "Ana", role: "Dev" }));
});
