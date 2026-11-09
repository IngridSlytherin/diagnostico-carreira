/* Interface do diagnóstico (index.html): lê currículo + autoavaliação, chama Integracoes/Regras e mostra o resultado. */
(function () {
  "use strict";

  var CHAVE_FORM = "career-readiness-assessment-v1"; // rascunho só das perguntas (nunca do currículo)
  var $ = function (id) { return document.getElementById(id); };
  var form = $("form-avaliador");
  var status = $("status");
  var metaPdf = null;
  var ultimoCtx = null;

  var ROTULO = { ok: "OK", aviso: "Melhorar", critico: "Crítico", info: "Info" };
  var ROTULO_TIPO = { divergencia: "Autoavaliação × evidência", evidencia: "Evidência", autoavaliacao: "Autoavaliação" };

  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Só os campos com atributo name (as perguntas). Currículo, vaga e GitHub não têm name e nunca são salvos.
  function lerRespostas() {
    var dados = {};
    Array.prototype.forEach.call(form.elements, function (campo) {
      if (campo.name) dados[campo.name] = campo.value;
    });
    return dados;
  }

  function lerAutoavaliacao() {
    var dados = lerRespostas();
    return window.Regras.temAutoavaliacao(dados) ? dados : null;
  }

  function salvarRascunho() {
    try { localStorage.setItem(CHAVE_FORM, JSON.stringify(lerRespostas())); } catch (e) { /* sem armazenamento: segue sem rascunho */ }
  }

  function restaurarRascunho() {
    try {
      var bruto = localStorage.getItem(CHAVE_FORM);
      if (!bruto) return;
      var dados = JSON.parse(bruto);
      Object.keys(dados).forEach(function (nome) {
        var campo = form.elements.namedItem(nome);
        if (campo && typeof dados[nome] === "string") campo.value = dados[nome];
      });
      if (window.Regras.temAutoavaliacao(dados)) status.textContent = "Suas respostas anteriores foram carregadas deste navegador.";
    } catch (e) { /* rascunho inválido: ignora */ }
  }

  form.addEventListener("change", function (ev) { if (ev.target.name) salvarRascunho(); });
  form.addEventListener("input", function (ev) { if (ev.target.name) salvarRascunho(); });

  // ------------------------------------------------------------- entradas

  $("arquivo").addEventListener("change", async function () {
    var arq = this.files && this.files[0];
    if (!arq) return;
    status.textContent = "Lendo o PDF no seu navegador…";
    try {
      var r = await window.Integracoes.extrairTextoPdf(arq);
      metaPdf = { paginas: r.paginas, imagens: r.imagens, colunas: r.colunas };
      $("texto-cv").value = r.texto;
      preencherGithub(r.texto);
      var nPal = (r.texto.match(/\S+/g) || []).length;
      status.textContent = nPal < 60
        ? "PDF lido, mas quase não tem texto (" + nPal + " palavras): ele parece ser uma imagem. Clique em “Gerar meu diagnóstico” para ver o que isso significa."
        : "PDF lido: " + r.paginas + " página(s). Confira o texto extraído e clique em “Gerar meu diagnóstico”.";
    } catch (e) {
      metaPdf = null;
      status.textContent = "Não consegui ler o PDF: " + e.message;
    }
  });

  $("texto-cv").addEventListener("change", function () { preencherGithub(this.value); });

  function preencherGithub(texto) {
    var u = window.Regras.extrairGithub(texto);
    if (u && !$("github").value.trim()) $("github").value = u;
  }

  $("limpar").addEventListener("click", function () {
    if (!window.confirm("Apagar o currículo, as respostas e o rascunho salvo neste navegador?")) return;
    form.reset();
    try { localStorage.removeItem(CHAVE_FORM); } catch (e) { /* nada a apagar */ }
    metaPdf = null;
    ultimoCtx = null;
    $("resultados").hidden = true;
    $("conteudo").textContent = "";
    status.textContent = "Tudo apagado deste navegador.";
  });

  form.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    var texto = $("texto-cv").value.trim();
    var vaga = $("texto-vaga").value.trim();
    var usuarioGh = $("github").value.trim();
    var f = lerAutoavaliacao();
    if (!texto && !metaPdf && !usuarioGh && !f) {
      status.textContent = "Envie o currículo ou responda pelo menos algumas perguntas da autoavaliação.";
      return;
    }
    var botao = $("gerar");
    botao.disabled = true;
    var ctx = { form: f, nome: String(lerRespostas().name || "").trim(), erros: [], data: new Date() };
    try {
      // um PDF sem texto (imagem) também é avaliado: é justamente o caso que o ATS não consegue ler
      if (texto || metaPdf) ctx.curriculo = window.Regras.analisarCurriculo(texto, metaPdf || {});
      if (vaga) ctx.vaga = window.Regras.compararVaga(texto, vaga);

      if ($("usar-lt").checked && texto) {
        if (ctx.curriculo && ctx.curriculo.stats.idioma === "pt") {
          ctx.escrita = { pulado: "O currículo está em português; traduza antes de verificar o inglês." };
        } else {
          status.textContent = "Verificando o inglês no LanguageTool…";
          try {
            ctx.escrita = window.Regras.analisarEscrita(await window.Integracoes.verificarIngles(texto));
          } catch (e) { ctx.erros.push("Inglês escrito: " + e.message); }
        }
      }
      if (usuarioGh) {
        status.textContent = "Consultando o GitHub…";
        try {
          ctx.github = window.Regras.analisarGithub(await window.Integracoes.buscarGithub(usuarioGh));
        } catch (e) { ctx.erros.push("GitHub: " + e.message); }
      }
      ctx.plano = window.Regras.gerarPlano(ctx);
      ultimoCtx = ctx;
      renderizar(ctx);
      status.textContent = ctx.erros.length ? "Diagnóstico gerado, com " + ctx.erros.length + " verificação(ões) que falharam (veja no topo do resultado)." : "Diagnóstico gerado.";
      $("resultados").hidden = false;
      $("resultados").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      status.textContent = "Algo deu errado ao avaliar: " + e.message;
    } finally {
      botao.disabled = false;
    }
  });

  // ------------------------------------------------------------- renderização

  function cartaoNota(rotulo, nota, nivel, extra) {
    if (nota === null || nota === undefined) {
      return '<div class="nota"><div class="rotulo">' + esc(rotulo) + '</div><div class="valor" style="color:var(--muted)">—</div><div class="hint">' + esc(extra || "Não avaliado") + '</div></div>';
    }
    return '<div class="nota"><div class="rotulo">' + esc(rotulo) + '</div><div class="valor">' + nota + '<span class="hint">/100</span></div>' +
      '<div class="bar" role="img" aria-label="' + nota + ' de 100"><span style="width:' + nota + '%"></span></div><div class="hint">' + esc(nivel) + (extra ? " · " + esc(extra) : "") + '</div></div>';
  }

  function listaChecks(checks) {
    var ordem = { critico: 0, aviso: 1, info: 2, ok: 3 };
    return '<ul class="lista-checks">' + checks.slice().sort(function (a, b) { return ordem[a.status] - ordem[b.status]; }).map(function (c) {
      return '<li><span class="selo ' + c.status + '">' + ROTULO[c.status] + '</span><div><strong>' + esc(c.titulo) + '</strong><br>' +
        '<span>' + esc(c.detalhe) + '</span>' + (c.acao ? '<br><span class="hint">→ ' + esc(c.acao) + '</span>' : "") +
        (c.exemplos && c.exemplos.length ? '<ul class="exemplos">' + c.exemplos.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "") +
        '</div></li>';
    }).join("") + "</ul>";
  }

  function blocoAcao(a) {
    return '<div class="acao p' + a.prioridade + '"><div class="tags"><span class="tag">' + esc(a.area) + '</span><span class="tag ' + a.tipo + '">' + esc(ROTULO_TIPO[a.tipo]) + '</span></div>' +
      '<h4>' + esc(a.titulo) + '</h4><p style="margin:0">' + esc(a.porque) + '</p>' +
      '<ol>' + a.passos.filter(Boolean).map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + '</ol>' +
      (a.exemplos && a.exemplos.length ? '<p class="hint" style="margin:8px 0 0">Bullets para reescrever:</p><ul class="exemplos">' + a.exemplos.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "") +
      '</div>';
  }

  function blocoAutoavaliacao(ctx) {
    if (!ctx.form) return "";
    var areas = window.Regras.pontuarAutoavaliacao(ctx.form);
    return '<h3 style="margin-top:18px">O que você declarou <span class="hint">(autoavaliação, sem conferência)</span></h3><div class="auto-lista">' +
      areas.map(function (a) {
        return '<div class="auto-item"><div class="score-line"><span>' + esc(a.nome) + '</span><span>' + (a.nota === null ? "sem resposta" : a.nota + "/100") + "</span></div>" +
          (a.nota === null ? "" : '<div class="bar" role="img" aria-label="' + a.nota + ' de 100"><span style="width:' + a.nota + '%"></span></div>') + "</div>";
      }).join("") + "</div>";
  }

  function renderizar(ctx) {
    var h = "";
    if (ctx.nome) h += "<p><strong>Resultado de " + esc(ctx.nome) + "</strong></p>";
    if (ctx.form && ctx.form.role) h += '<p class="hint">Objetivo: ' + esc([ctx.form.role, ctx.form.market, ctx.form.level].filter(Boolean).join(" · ")) + "</p>";
    ctx.erros.forEach(function (e) { h += '<p class="aviso-erro">' + esc(e) + "</p>"; });

    h += '<h3 style="margin-top:0">Medido nos seus materiais</h3><div class="placar">';
    h += cartaoNota("Currículo", ctx.curriculo && ctx.curriculo.pontuacao, ctx.curriculo && ctx.curriculo.nivel, ctx.curriculo ? null : "Sem currículo");
    h += cartaoNota("Compatibilidade com a vaga", ctx.vaga && ctx.vaga.compatibilidade, ctx.vaga && ctx.vaga.nivel, ctx.vaga ? (ctx.vaga.compatibilidade === null ? "Nenhuma tecnologia conhecida na vaga" : ctx.vaga.termosNaVaga + " termos na vaga") : "Sem vaga");
    h += cartaoNota("Inglês escrito", ctx.escrita && !ctx.escrita.pulado ? ctx.escrita.pontuacao : null, ctx.escrita && ctx.escrita.nivel, ctx.escrita ? (ctx.escrita.pulado ? "Pulado" : ctx.escrita.graves + " erro(s)") : "Verificação desligada");
    h += cartaoNota("GitHub", ctx.github && ctx.github.pontuacao, ctx.github && ctx.github.nivel, ctx.github ? "@" + ctx.github.usuario : "Sem usuário");
    h += "</div>";
    if (ctx.curriculo && ctx.curriculo.limitadaPor && ctx.curriculo.limitadaPor.length) {
      h += '<p class="aviso-erro">A nota do currículo foi limitada por falha eliminatória: ' + esc(ctx.curriculo.limitadaPor.join("; ")) + ". Um recrutador descartaria antes de ler o resto, então corrija isso primeiro.</p>";
    }
    h += '<p class="hint" style="margin-top:10px">Escala: 0–39 Fraco · 40–59 Em desenvolvimento · 60–74 Competitivo · 75–89 Forte · 90–100 Excelente.</p>';
    h += blocoAutoavaliacao(ctx);

    // plano
    var urgentes = ctx.plano.filter(function (a) { return a.prioridade === 1; });
    var depois = ctx.plano.filter(function (a) { return a.prioridade !== 1; });
    h += "<h3>Comece por aqui</h3>";
    h += urgentes.length ? urgentes.map(blocoAcao).join("") : "<p>Nenhum ponto crítico. Siga para os ajustes abaixo.</p>";
    if (depois.length) h += "<h3>Depois</h3>" + depois.map(blocoAcao).join("");

    // detalhes
    if (ctx.curriculo) {
      var s = ctx.curriculo.stats;
      h += "<h3>Currículo: o que foi verificado</h3>";
      h += '<p class="hint">' + s.palavras + " palavras" + (s.paginas ? " · " + s.paginas + " página(s)" : "") + " · " + s.bullets + " bullets analisados" +
        (s.comVerboPct !== null ? " · " + s.comVerboPct + "% com verbo de ação · " + s.comMetricaPct + "% com números" : "") + "</p>";
      h += listaChecks(ctx.curriculo.checks);
    }
    if (ctx.vaga) {
      var v = ctx.vaga;
      h += "<h3>Vaga</h3>";
      v.alertas.forEach(function (a) { h += '<p class="aviso-erro">' + esc(a) + "</p>"; });
      v.positivos.concat(v.info).forEach(function (a) { h += '<p class="hint" style="margin:4px 0">• ' + esc(a) + "</p>"; });
      if (v.termosNaVaga) {
        h += '<p style="margin-top:10px"><strong>Tecnologias da vaga</strong> <span class="hint">(verde = está no currículo)</span></p><div class="chips">' +
          v.presentes.map(function (t) { return '<span class="chip tem">' + esc(t) + "</span>"; }).join("") +
          v.faltando.map(function (t) { return '<span class="chip falta">' + esc(t) + "</span>"; }).join("") + "</div>";
        h += '<p class="hint" style="margin-top:8px">Adicione só o que você realmente já usou. Inventar uma tecnologia aparece na primeira entrevista técnica.</p>';
      }
    }
    if (ctx.escrita) {
      h += "<h3>Inglês escrito (LanguageTool)</h3>";
      if (ctx.escrita.pulado) {
        h += "<p>" + esc(ctx.escrita.pulado) + "</p>";
      } else if (!ctx.escrita.itens.length) {
        h += "<p>Nenhum problema relevante encontrado em " + ctx.escrita.palavras + " palavras. O corretor não avalia naturalidade: peça a um falante fluente uma leitura final.</p>";
      } else {
        h += '<p class="hint">' + ctx.escrita.graves + " de gramática/ortografia e " + ctx.escrita.estilo + " de estilo, em " + ctx.escrita.palavras + " palavras. Itens de ortografia em nomes próprios (empresas, produtos) podem ser falso positivo.</p>";
        ctx.escrita.itens.slice(0, 25).forEach(function (i) {
          var c = i.contexto;
          var pos = c.indexOf(i.trecho);
          var ctxHtml = pos === -1 ? esc(c) : esc(c.slice(0, pos)) + "<mark>" + esc(i.trecho) + "</mark>" + esc(c.slice(pos + i.trecho.length));
          h += '<div class="erro-lt"><span class="selo ' + (i.tipo === "estilo" ? "info" : "aviso") + '">' + esc(i.tipo) + "</span> " + esc(i.mensagem) +
            (i.sugestoes.length ? ' <strong>→ ' + esc(i.sugestoes.join(" / ")) + "</strong>" : "") +
            (i.possivelNomeProprio ? ' <span class="hint">(pode ser nome próprio)</span>' : "") +
            '<br><span class="hint">…' + ctxHtml + "…</span></div>";
        });
        if (ctx.escrita.itens.length > 25) h += '<p class="hint">+ ' + (ctx.escrita.itens.length - 25) + " item(ns) no relatório baixado.</p>";
      }
    }
    if (ctx.github) {
      h += '<h3>GitHub: <a href="' + esc(ctx.github.perfil) + '" target="_blank" rel="noopener">@' + esc(ctx.github.usuario) + "</a></h3>";
      h += listaChecks(ctx.github.checks);
    }

    h += '<details style="margin-top:22px"><summary>Como as notas são calculadas</summary><p class="hint" style="margin-top:8px">' +
      "Cada verificação tem um peso. “OK” vale o peso inteiro, “Melhorar” vale metade e “Crítico” vale zero; a nota é a porcentagem obtida. " +
      "Compatibilidade com a vaga = tecnologias da vaga que aparecem no currículo ÷ tecnologias da vaga reconhecidas. " +
      "Inglês escrito = 100 − 20 × (erros por 100 palavras), com erros de estilo valendo 0,3. " +
      "As regras olham forma e evidências (verbos, números, seções, links), não a qualidade real da sua experiência. Use como triagem, não como veredito.</p></details>";

    $("conteudo").innerHTML = h;
  }

  // ------------------------------------------------------------- relatório

  function markdown(ctx) {
    var d = ctx.data;
    var data = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    var L = ["# Diagnóstico de carreira internacional", "", "Data: " + data];
    if (ctx.nome) L.push("Pessoa: " + ctx.nome);
    if (ctx.form && ctx.form.role) L.push("Objetivo: " + [ctx.form.role, ctx.form.market, ctx.form.level].filter(Boolean).join(" · "));
    L.push("");
    function nota(rot, n, nv) { L.push("- " + rot + ": " + (n === null || n === undefined ? "não avaliado" : n + "/100 (" + nv + ")")); }
    L.push("## Notas");
    nota("Currículo", ctx.curriculo && ctx.curriculo.pontuacao, ctx.curriculo && ctx.curriculo.nivel);
    if (ctx.curriculo && ctx.curriculo.limitadaPor && ctx.curriculo.limitadaPor.length) L.push("  - Nota limitada por: " + ctx.curriculo.limitadaPor.join("; "));
    nota("Compatibilidade com a vaga", ctx.vaga && ctx.vaga.compatibilidade, ctx.vaga && ctx.vaga.nivel);
    nota("Inglês escrito", ctx.escrita && !ctx.escrita.pulado ? ctx.escrita.pontuacao : null, ctx.escrita && ctx.escrita.nivel);
    nota("GitHub", ctx.github && ctx.github.pontuacao, ctx.github && ctx.github.nivel);
    ctx.erros.forEach(function (e) { L.push("- Falhou: " + e); });
    if (ctx.form) {
      L.push("", "## Autoavaliação (declarado)");
      window.Regras.pontuarAutoavaliacao(ctx.form).forEach(function (a) { L.push("- " + a.nome + ": " + (a.nota === null ? "sem resposta" : a.nota + "/100")); });
    }

    L.push("", "## Plano de ação");
    ctx.plano.forEach(function (a, i) {
      L.push("", "### " + (i + 1) + ". " + a.titulo + " (" + a.area + (a.prioridade === 1 ? ", urgente" : "") + ")", "", a.porque, "");
      a.passos.filter(Boolean).forEach(function (p) { L.push("- [ ] " + p); });
      (a.exemplos || []).forEach(function (x) { L.push("  - Reescrever: " + x); });
    });

    function checksMd(titulo, checks) {
      L.push("", "## " + titulo);
      checks.forEach(function (c) {
        L.push("- **[" + ROTULO[c.status] + "] " + c.titulo + "**: " + c.detalhe + (c.acao ? " → " + c.acao : ""));
      });
    }
    if (ctx.curriculo) checksMd("Currículo: verificações", ctx.curriculo.checks);
    if (ctx.vaga) {
      L.push("", "## Vaga");
      ctx.vaga.alertas.concat(ctx.vaga.positivos, ctx.vaga.info).forEach(function (x) { L.push("- " + x); });
      L.push("- Presentes no currículo: " + (ctx.vaga.presentes.join(", ") || "nenhuma"));
      L.push("- Faltando: " + (ctx.vaga.faltando.join(", ") || "nenhuma"));
    }
    if (ctx.escrita && !ctx.escrita.pulado) {
      L.push("", "## Inglês escrito (LanguageTool)");
      ctx.escrita.itens.forEach(function (i) {
        L.push("- [" + i.tipo + "] “" + i.trecho + "”: " + i.mensagem + (i.sugestoes.length ? " → " + i.sugestoes.join(" / ") : "") + "  \n  …" + i.contexto + "…");
      });
    }
    if (ctx.github) checksMd("GitHub (@" + ctx.github.usuario + ")", ctx.github.checks);
    L.push("", "---", "Gerado por regras visíveis (sem IA). Não estima chance de contratação.", "");
    return L.join("\n");
  }

  $("baixar").addEventListener("click", function () {
    if (!ultimoCtx) return;
    var url = URL.createObjectURL(new Blob([markdown(ultimoCtx)], { type: "text/markdown;charset=utf-8" }));
    var a = document.createElement("a");
    a.href = url;
    a.download = "diagnostico-carreira-internacional.md";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });
  $("imprimir").addEventListener("click", function () { window.print(); });

  restaurarRascunho();
}());
