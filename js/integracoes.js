/*
 * Integrações externas do avaliador:
 *  - pdf.js (local, no navegador): extrai texto, nº de páginas, imagens e suspeita de colunas.
 *  - LanguageTool (API pública e gratuita): verifica gramática/ortografia do texto, anonimizado.
 *  - GitHub REST API (pública, sem token): lê perfil, repositórios e READMEs.
 */
(function (root) {
  "use strict";

  // ------------------------------------------------------------- pdf.js

  async function extrairTextoPdf(arquivo) {
    var pdfjs = root.pdfjsLib;
    if (!pdfjs) throw new Error("O leitor de PDF não carregou (sem internet?). Cole o texto do currículo no campo abaixo.");
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
    var dados = new Uint8Array(await arquivo.arrayBuffer());
    var pdf = await pdfjs.getDocument({ data: dados }).promise;
    var linhas = [];
    var imagens = 0;
    var paginasColunas = 0;
    var opsImagem = [pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintInlineImageXObject, pdfjs.OPS.paintImageXObjectRepeat].filter(function (op) { return op !== undefined; });

    for (var p = 1; p <= pdf.numPages; p++) {
      var pagina = await pdf.getPage(p);
      var conteudo = await pagina.getTextContent();
      var largura = pagina.getViewport({ scale: 1 }).width;
      var itens = conteudo.items.filter(function (it) { return it.str && it.str.trim(); }).map(function (it) {
        return { x: it.transform[4], y: it.transform[5], fim: it.transform[4] + (it.width || 0), str: it.str };
      });

      var colunaX = detectarColuna(agruparLinhas(itens, largura), largura);
      if (colunaX !== null) colunaX = acharVao(itens, colunaX, largura);
      if (colunaX !== null) {
        // lê cada coluna inteira, de cima para baixo, em vez de misturar as duas linha a linha
        paginasColunas++;
        var esquerda = itens.filter(function (it) { return it.x < colunaX - 3; });
        var direita = itens.filter(function (it) { return it.x >= colunaX - 3; });
        // a coluna mais larga (conteúdo principal) vem primeiro; a lateral (contato, skills) depois
        var principalDireita = largura - colunaX > colunaX;
        var a = textoDasLinhas(agruparLinhas(principalDireita ? direita : esquerda, largura));
        var b = textoDasLinhas(agruparLinhas(principalDireita ? esquerda : direita, largura));
        linhas = linhas.concat(a, [""], b);
      } else {
        linhas = linhas.concat(textoDasLinhas(agruparLinhas(itens, largura)));
      }
      linhas.push("");

      try {
        var ops = await pagina.getOperatorList();
        ops.fnArray.forEach(function (fn) { if (opsImagem.indexOf(fn) !== -1) imagens++; });
      } catch (e) { /* contagem de imagens é opcional */ }
    }

    return {
      texto: linhas.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
      paginas: pdf.numPages,
      imagens: imagens,
      colunas: paginasColunas > 0
    };
  }

  // Agrupa pedaços de texto em linhas (mesma altura y, com tolerância) e marca os segmentos
  // separados por espaços grandes.
  function agruparLinhas(itens, largura) {
    var grupos = [];
    itens.forEach(function (it) {
      var g = null;
      for (var i = 0; i < grupos.length; i++) if (Math.abs(grupos[i].y - it.y) < 3) { g = grupos[i]; break; }
      if (!g) { g = { y: it.y, itens: [] }; grupos.push(g); }
      g.itens.push(it);
    });
    grupos.sort(function (a, b) { return b.y - a.y; });
    return grupos.map(function (g) {
      g.itens.sort(function (a, b) { return a.x - b.x; });
      var texto = "";
      var segmentos = [];
      var fimAnterior = null;
      g.itens.forEach(function (it) {
        var gap = fimAnterior === null ? Infinity : it.x - fimAnterior;
        if (gap > largura * 0.04) segmentos.push({ x: it.x, texto: "" });
        if (fimAnterior !== null && gap > 1 && !/\s$/.test(texto) && !/^\s/.test(it.str)) texto += " ";
        texto += it.str;
        segmentos[segmentos.length - 1].texto += it.str;
        fimAnterior = it.fim;
      });
      return { texto: texto, segmentos: segmentos };
    });
  }

  function textoDasLinhas(grupos) {
    return grupos.map(function (g) { return g.texto; });
  }

  // Duas colunas = muitas linhas com um bloco de texto começando no MESMO x, longe da margem esquerda.
  // Datas alinhadas à direita começam em x diferentes (tamanhos diferentes), então não formam coluna.
  function detectarColuna(grupos, largura) {
    if (grupos.length < 10) return null;
    var margem = Infinity;
    grupos.forEach(function (g) { if (g.segmentos.length) margem = Math.min(margem, g.segmentos[0].x); });
    var contagem = {};
    grupos.forEach(function (g) {
      var vistos = {};
      g.segmentos.forEach(function (s) {
        if (s.x - margem < largura * 0.2 || s.texto.trim().length < 12) return;
        var bin = Math.round(s.x / 4);
        if (vistos[bin]) return;
        vistos[bin] = true;
        contagem[bin] = (contagem[bin] || 0) + 1;
      });
    });
    var melhor = null;
    Object.keys(contagem).forEach(function (bin) {
      // junta bins vizinhos (pequenas variações de x)
      var n = (contagem[bin] || 0) + (contagem[+bin - 1] || 0) + (contagem[+bin + 1] || 0);
      if (!melhor || n > melhor.n) melhor = { bin: +bin, n: n };
    });
    if (!melhor || melhor.n < 8 || melhor.n / grupos.length < 0.25) return null;
    return melhor.bin * 4 - 4;
  }

  // O alinhamento achado pode ser o recuo dos bullets, não o começo da coluna. O corte certo é o
  // vão vertical (faixa sem texto) mais à direita antes desse alinhamento.
  function acharVao(itens, colunaX, largura) {
    var tolerancia = Math.max(1, Math.round(itens.length * 0.03)); // ex.: nome centralizado atravessando as colunas
    var inicio = null;
    var melhor = null;
    for (var x = Math.round(largura * 0.08); x <= colunaX; x += 2) {
      var cruzam = 0;
      for (var i = 0; i < itens.length && cruzam <= tolerancia; i++) if (itens[i].x < x - 1 && itens[i].fim > x + 1) cruzam++;
      if (cruzam <= tolerancia) {
        if (inicio === null) inicio = x;
      } else if (inicio !== null) {
        if (x - inicio >= 8) melhor = { de: inicio, ate: x };
        inicio = null;
      }
    }
    if (inicio !== null && colunaX - inicio >= 8) melhor = { de: inicio, ate: colunaX };
    return melhor ? (melhor.de + melhor.ate) / 2 : colunaX;
  }

  // ------------------------------------------------------------- LanguageTool

  // Remove dados de contato e a provável linha do nome antes de enviar o texto para fora.
  function anonimizar(texto) {
    var linhas = String(texto).split(/\r?\n/);
    var i = linhas.findIndex(function (l) { return l.trim(); });
    if (i !== -1 && linhas[i].trim().split(/\s+/).length <= 5 && !/\d/.test(linhas[i])) linhas.splice(i, 1);
    return linhas.join("\n")
      .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "email")
      .replace(/(https?:\/\/)?(www\.)?[\w-]+\.(com|br|io|dev|app|me|net|org)\b(\/[^\s)]*)?/g, "link")
      .replace(/\+?\d[\d\s().-]{7,}\d/g, function (m) { return m.replace(/\D/g, "").length >= 10 ? "phone" : m; });
  }

  async function verificarIngles(texto) {
    var enviado = anonimizar(texto);
    if (enviado.length > 18000) enviado = enviado.slice(0, enviado.lastIndexOf("\n", 18000));
    var corpo = new URLSearchParams({ text: enviado, language: "en-US" });
    var resp;
    try {
      resp = await fetch("https://api.languagetool.org/v2/check", { method: "POST", body: corpo });
    } catch (e) {
      throw new Error("Não consegui falar com o LanguageTool (sem internet ou bloqueado).");
    }
    if (resp.status === 429) throw new Error("O LanguageTool limitou as consultas (plano gratuito). Espere 1 minuto e tente de novo.");
    if (!resp.ok) throw new Error("O LanguageTool respondeu com erro " + resp.status + ".");
    var json = await resp.json();
    var nPal = (enviado.match(/[A-Za-zÀ-ÿ0-9][\w'’+#.-]*/g) || []).length;
    return { matches: json.matches || [], textoEnviado: enviado, palavras: nPal };
  }

  // ------------------------------------------------------------- GitHub

  async function gh(caminho, raw) {
    var resp;
    try {
      resp = await fetch("https://api.github.com" + caminho, { headers: { Accept: raw ? "application/vnd.github.raw" : "application/vnd.github+json" } });
    } catch (e) {
      throw new Error("Não consegui falar com a API do GitHub (sem internet ou bloqueado).");
    }
    if (resp.status === 404) return null;
    if (resp.status === 403 || resp.status === 429) throw new Error("O GitHub limitou as consultas sem login (60 por hora por rede). Tente de novo mais tarde.");
    if (!resp.ok) throw new Error("O GitHub respondeu com erro " + resp.status + ".");
    return raw ? resp.text() : resp.json();
  }

  async function buscarGithub(usuario) {
    usuario = String(usuario || "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?github\.com\//i, "").split(/[/?#]/)[0];
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(usuario)) throw new Error("Usuário do GitHub inválido.");
    var perfil = await gh("/users/" + encodeURIComponent(usuario));
    if (!perfil) throw new Error("Não encontrei o usuário “" + usuario + "” no GitHub.");
    var repos = (await gh("/users/" + encodeURIComponent(usuario) + "/repos?per_page=100&sort=pushed")) || [];
    var proprios = repos.filter(function (r) { return !r.fork && !r.archived; })
      .sort(function (a, b) { return (b.stargazers_count - a.stargazers_count) || (new Date(b.pushed_at) - new Date(a.pushed_at)); })
      .slice(0, 4);
    var readmes = {};
    await Promise.all(proprios.map(async function (r) {
      readmes[r.name] = (await gh("/repos/" + encodeURIComponent(usuario) + "/" + encodeURIComponent(r.name) + "/readme", true)) || "";
    }));
    var readmePerfil = await gh("/repos/" + encodeURIComponent(usuario) + "/" + encodeURIComponent(usuario) + "/readme", true);
    return { usuario: perfil, repos: repos, readmes: readmes, temReadmePerfil: Boolean(readmePerfil) };
  }

  root.Integracoes = { extrairTextoPdf: extrairTextoPdf, verificarIngles: verificarIngles, buscarGithub: buscarGithub, anonimizar: anonimizar };
}(typeof globalThis !== "undefined" ? globalThis : this));
