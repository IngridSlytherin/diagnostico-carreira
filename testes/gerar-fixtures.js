// Gera os PDFs de teste a partir dos HTMLs em testes/fixtures/.
// Rodar com: node testes/gerar-fixtures.js
const fs = require("fs");
const path = require("path");
const { rodar, urlArquivo } = require("./chrome");

const dir = path.join(__dirname, "fixtures");
fs.readdirSync(dir).filter((f) => f.endsWith(".html")).forEach((f) => {
  const pdf = path.join(dir, f.replace(/\.html$/, ".pdf"));
  rodar(["--no-pdf-header-footer", "--virtual-time-budget=2000", "--print-to-pdf=" + pdf, urlArquivo(path.join(dir, f))]);
  console.log("gerado:", path.basename(pdf), fs.statSync(pdf).size, "bytes");
});
