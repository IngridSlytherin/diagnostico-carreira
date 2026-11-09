// Testes de ponta a ponta: abre index.html (diagnóstico com currículo) num Chrome headless, envia PDFs reais,
// clica em "Gerar meu diagnóstico" e confere o resultado na página.
// LanguageTool e GitHub são simulados (fetch falso) para o teste não depender de internet nem de limites.
// O pdf.js vem do CDN, então é preciso internet. Rodar com: node --test testes/navegador.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { acharChrome, rodar, urlArquivo } = require("./chrome");

const RAIZ = path.join(__dirname, "..");
const FIXTURES = path.join(__dirname, "fixtures");
const semChrome = !acharChrome() && "Chrome/Edge não encontrado (defina CHROME_PATH)";

const FORM_BOM = { role: "Full-Stack Developer", market: "LATAM", level: "Pleno / intermediário", resumeCurrent: "1", resumeTargeted: "1", resumeEvidence: "1",
  portfolioRelevant: "1", portfolioExplained: "1", portfolioDemo: "1", languageSpeaking: "1", languageWriting: "1", interviewExamples: "1", interviewTechnical: "1", interviewPractice: "1" };

const README_BOM = "# Invoice Tracker\n\n" + "A multi-tenant invoicing app for freelancers built with Laravel and React. ".repeat(8) +
  "\n\n![screenshot](docs/s.png)\n\n## Tech stack\nLaravel, React\n\n## Getting started\ncomposer install\n\n## Demo\nhttps://invoice.vercel.app\n\n## Architecture decisions\nQueues for PDFs.";

function ghBom(usuario) {
  const repo = (n) => ({ name: n, fork: false, archived: false, stargazers_count: 3, pushed_at: new Date(Date.now() - 5 * 864e5).toISOString(), description: "Tool", homepage: "https://x.vercel.app", topics: ["laravel"] });
  return {
    ["/users/" + usuario]: { body: { login: usuario, name: "Jane", bio: "Full-stack developer building tools with Laravel and React", location: "Brazil", blog: "https://linkedin.com/in/jane", html_url: "https://github.com/" + usuario } },
    ["/users/" + usuario + "/repos"]: { body: ["a", "b", "c", "d"].map(repo) },
    ["/repos/" + usuario + "/a/readme"]: { body: README_BOM }, ["/repos/" + usuario + "/b/readme"]: { body: README_BOM },
    ["/repos/" + usuario + "/c/readme"]: { body: README_BOM }, ["/repos/" + usuario + "/d/readme"]: { body: README_BOM },
    ["/repos/" + usuario + "/" + usuario + "/readme"]: { body: "# Hi" }
  };
}

function cenario(c) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "avaliador-"));
  const jsDir = urlArquivo(path.join(RAIZ, "js")) + "/";
  let html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8").replace(/src="js\//g, 'src="' + jsDir);
  const pdf64 = c.pdf ? fs.readFileSync(path.join(FIXTURES, c.pdf)).toString("base64") : "";
  const auto = `
<script>
(function () {
  var C = ${JSON.stringify({ texto: c.texto || "", vaga: c.vaga || "", form: c.form || null, lt: c.lt || null, gh: c.gh || {}, github: c.github || "", usarLt: Boolean(c.lt) })};
  var PDF = "${pdf64}";
  function resp(r) { return new Response(typeof r.body === "string" ? r.body : JSON.stringify(r.body), { status: r.status || 200 }); }
  window.fetch = async function (url, opts) {
    if (url.indexOf("languagetool") !== -1) { document.body.setAttribute("data-lt-enviado", opts.body.toString()); return resp(C.lt); }
    var caminho = url.replace("https://api.github.com", "").split("?")[0];
    return resp(C.gh[decodeURIComponent(caminho)] || { status: 404, body: "" });
  };
  try { localStorage.clear(); } catch (e) {}
  function enviar() {
    var form = document.getElementById("form-avaliador");
    // responde as perguntas como uma pessoa faria (dispara o salvamento do rascunho)
    Object.keys(C.form || {}).forEach(function (nome) {
      var campo = form.elements.namedItem(nome);
      if (!campo) throw new Error("campo não existe na página: " + nome);
      campo.value = C.form[nome];
      campo.dispatchEvent(new Event("change", { bubbles: true }));
    });
    if (C.texto) document.getElementById("texto-cv").value = C.texto;
    document.getElementById("texto-vaga").value = C.vaga;
    document.getElementById("usar-lt").checked = C.usarLt;
    if (C.github) document.getElementById("github").value = C.github;
    var obs = new MutationObserver(function () {
      if (document.getElementById("resultados").hidden) return;
      try { document.body.setAttribute("data-rascunho", localStorage.getItem("career-readiness-assessment-v1") || ""); } catch (e) {}
      document.body.setAttribute("data-pronto", "1");
    });
    obs.observe(document.getElementById("resultados"), { attributes: true });
    document.getElementById("form-avaliador").requestSubmit();
  }
  window.addEventListener("load", function () {
    if (!PDF) return enviar();
    var bytes = Uint8Array.from(atob(PDF), function (ch) { return ch.charCodeAt(0); });
    var dt = new DataTransfer();
    dt.items.add(new File([bytes], "cv.pdf", { type: "application/pdf" }));
    var input = document.getElementById("arquivo");
    input.files = dt.files;
    input.dispatchEvent(new Event("change"));
    var espera = setInterval(function () {
      var st = document.getElementById("status").textContent;
      if (/PDF lido|Não consegui/.test(st)) {
        clearInterval(espera);
        document.body.setAttribute("data-texto-cv", document.getElementById("texto-cv").value);
        document.body.setAttribute("data-status-pdf", st);
        enviar();
      }
    }, 50);
  });
}());
</script>`;
  html = html.replace("</body>", auto + "\n</body>");
  const arquivo = path.join(tmp, "harness.html");
  fs.writeFileSync(arquivo, html);
  const dom = rodar(["--user-data-dir=" + path.join(tmp, "perfil"), "--virtual-time-budget=30000", "--dump-dom", urlArquivo(arquivo)], 120000);
  fs.rmSync(tmp, { recursive: true, force: true });
  const conteudo = (dom.match(/<div id="conteudo">([\s\S]*?)<\/div>\s*<div class="actions">/) || [, ""])[1];
  const texto = conteudo.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const nota = (rotulo) => {
    const m = conteudo.match(new RegExp('<div class="rotulo">' + rotulo + '</div><div class="valor"[^>]*>(\\d+|—)'));
    return m ? (m[1] === "—" ? null : Number(m[1])) : undefined;
  };
  const corpo = (dom.match(/<body([^>]*)>/) || [, ""])[1];
  const attr = (n) => { const m = corpo.match(new RegExp(n + '="([^"]*)"')); return m ? m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"') : null; };
  return { dom, conteudo, texto, nota, pronto: attr("data-pronto") === "1", textoCv: attr("data-texto-cv"), statusPdf: attr("data-status-pdf"), rascunho: attr("data-rascunho"), ltEnviado: attr("data-lt-enviado"), xss: attr("data-xss") };
}

test("currículo bom (PDF real): nota alta, sem urgências, inglês enviado anonimizado", { skip: semChrome }, () => {
  const r = cenario({
    pdf: "cv-bom.pdf", form: FORM_BOM, github: "janedoe", gh: ghBom("janedoe"),
    vaga: "Senior Full-Stack Engineer. Laravel, React, TypeScript, PostgreSQL, Docker. Open to LATAM. Contractor via Deel.",
    lt: { body: { matches: [] } }
  });
  assert.ok(r.pronto, "resultado não apareceu");
  assert.ok(r.nota("Currículo") >= 90, "nota " + r.nota("Currículo"));
  assert.ok(r.nota("GitHub") >= 90, "github " + r.nota("GitHub"));
  assert.strictEqual(r.nota("Inglês escrito"), 100);
  assert.match(r.texto, /Nenhum ponto crítico/);
  assert.match(r.conteudo, /chip falta">PostgreSQL/);
  assert.match(r.texto, /aceita o Brasil\/LATAM/);
  assert.ok(r.ltEnviado, "LanguageTool não foi chamado");
  const enviado = decodeURIComponent(r.ltEnviado.replace(/\+/g, " "));
  assert.ok(!/jane@example\.com/.test(enviado), "e-mail vazou para o LanguageTool");
  assert.ok(!/Jane Doe/.test(enviado), "nome vazou para o LanguageTool");
  assert.ok(!/linkedin\.com|github\.com/.test(enviado), "links vazaram para o LanguageTool");
  assert.match(enviado, /Built a billing API/);
});

test("duas colunas + foto: detecta, avisa e limita a nota", { skip: semChrome }, () => {
  const r = cenario({ pdf: "cv-duas-colunas.pdf" });
  assert.ok(r.pronto);
  assert.match(r.texto, /Layout em colunas/);
  assert.match(r.texto, /Imagens no PDF/);
  assert.match(r.texto, /limitada por falha eliminatória/);
  assert.ok(r.nota("Currículo") <= 74);
  assert.match(r.textoCv, /Back-End Developer, Loja Rápida · Feb 2022/, "colunas não foram separadas na ordem certa");
  assert.ok(r.textoCv.indexOf("Experience") < r.textoCv.indexOf("Contact"), "coluna principal deveria vir antes da lateral");
});

test("PDF que é só imagem: nota 0 e explicação", { skip: semChrome }, () => {
  const r = cenario({ pdf: "cv-imagem.pdf" });
  assert.ok(r.pronto);
  assert.strictEqual(r.nota("Currículo"), 0);
  assert.match(r.texto, /O texto do PDF não pode ser lido/);
  assert.match(r.statusPdf, /parece ser uma imagem/, "o status deveria avisar logo no envio");
});

test("currículo em português sem autoavaliação: pula LanguageTool e pede formulário", { skip: semChrome }, () => {
  const r = cenario({ pdf: "cv-portugues.pdf", lt: { body: { matches: [] } } });
  assert.ok(r.pronto);
  assert.ok(r.nota("Currículo") <= 39);
  assert.match(r.texto, /100% em inglês/);
  assert.match(r.texto, /Preencher a autoavaliação/);
  assert.match(r.texto, /Pulado/);
  assert.strictEqual(r.ltEnviado, null, "não deveria chamar o LanguageTool para texto em português");
  assert.match(r.texto, /data de nascimento\/idade, estado civil, CPF\/RG, nacionalidade/);
});

test("currículo longo e repetido: limitado a 59", { skip: semChrome }, () => {
  const r = cenario({ pdf: "cv-longo.pdf" });
  assert.ok(r.pronto);
  assert.ok(r.nota("Currículo") <= 59);
  assert.match(r.texto, /Bullets repetidos/);
});

test("APIs fora do ar ou no limite: mostra o erro e entrega o resto", { skip: semChrome }, () => {
  const r = cenario({
    texto: "Jane Doe\njane@example.com\nExperience\n- Built a billing API used by 3,000 users.\n- Reduced costs by 20%.\n- Led a team of 4.\nSkills\nPHP",
    lt: { status: 429, body: "" }, github: "janedoe", gh: { "/users/janedoe": { status: 403, body: "" } }
  });
  assert.ok(r.pronto);
  assert.match(r.texto, /LanguageTool limitou as consultas/);
  assert.match(r.texto, /GitHub limitou as consultas/);
  assert.ok(typeof r.nota("Currículo") === "number");
});

test("usuário do GitHub inexistente", { skip: semChrome }, () => {
  const r = cenario({ texto: "Experience\n- Built things for 3 clients.", github: "nao-existe-123", gh: {} });
  assert.ok(r.pronto);
  assert.match(r.texto, /Não encontrei o usuário “nao-existe-123”/);
});

test("segurança: HTML no currículo, na resposta do LanguageTool e no GitHub não é executado", { skip: semChrome }, () => {
  const payload = `<img src=x onerror="document.body.setAttribute('data-xss','1')">`;
  const gh = ghBom("evil");
  gh["/users/evil"].body.bio = payload;
  gh["/users/evil/repos"].body[0].name = "a" + payload;
  const r = cenario({
    texto: "Jane\njane@example.com\nExperience\n- Built " + payload + " for 3 clients.\n- Worked on stuff " + payload + "\n- Helped team.\nSkills\nPHP",
    github: "evil", gh,
    lt: { body: { matches: [{ message: payload, replacements: [{ value: payload }], context: { text: payload + " text", offset: 0, length: 5 }, rule: { id: "X", issueType: "grammar", category: { id: "GRAMMAR" } } }] } }
  });
  assert.ok(r.pronto);
  assert.strictEqual(r.xss, null, "o payload foi executado!");
  assert.ok(!/<img src=x/.test(r.conteudo), "HTML não foi escapado");
  assert.match(r.conteudo, /&lt;img src=x/);
});

test("só a autoavaliação (sem currículo): gera plano com inglês e entrevistas", { skip: semChrome }, () => {
  const r = cenario({ form: { role: "Backend Developer", languageSpeaking: "0.5", interviewPractice: "0", interviewExamples: "0" } });
  assert.ok(r.pronto);
  assert.match(r.texto, /nativos/);
  assert.match(r.texto, /Treinar entrevistas em voz alta/);
  assert.match(r.texto, /histórias STAR/);
  assert.strictEqual(r.nota("Currículo"), null);
});

test("página única: currículo + perguntas juntos, rascunho guarda só as respostas", { skip: semChrome }, () => {
  const r = cenario({
    pdf: "cv-bom.pdf",
    form: { name: "Ana", role: "Full-Stack Developer", market: "EUA", resumeEvidence: "1", languageSpeaking: "0.5", interviewPractice: "0" }
  });
  assert.ok(r.pronto);
  assert.match(r.texto, /Resultado de Ana/);
  assert.match(r.texto, /Objetivo: Full-Stack Developer · EUA/);
  assert.match(r.texto, /O que você declarou/);
  assert.match(r.texto, /Inglês \(percepção\) 50\/100/);
  assert.match(r.texto, /Praticar inglês falado com nativos/);
  assert.ok(r.rascunho, "o rascunho das respostas deveria ser salvo");
  const rascunho = JSON.parse(r.rascunho);
  assert.strictEqual(rascunho.role, "Full-Stack Developer");
  assert.ok(!/Built a billing API|jane@example\.com/.test(r.rascunho), "o currículo NÃO pode ser salvo no navegador");
});
