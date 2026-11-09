// Localiza o Chrome/Edge instalado e roda em modo headless (sem janela).
const fs = require("fs");
const { execFileSync } = require("child_process");

const CANDIDATOS = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser"
].filter(Boolean);

function acharChrome() {
  return CANDIDATOS.find((c) => fs.existsSync(c)) || null;
}

function rodar(args, timeout = 60000) {
  const chrome = acharChrome();
  if (!chrome) throw new Error("Chrome/Edge não encontrado. Defina CHROME_PATH.");
  return execFileSync(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", ...args], {
    encoding: "utf8", timeout, maxBuffer: 50 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"]
  });
}

function urlArquivo(caminho) {
  return "file:///" + caminho.replace(/\\/g, "/").replace(/^\/+/, "");
}

module.exports = { acharChrome, rodar, urlArquivo };
