#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline");

function loadEnv(file = ".env") {
  const env = {};
  if (!fs.existsSync(file)) return env;

  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const i = line.indexOf("=");
    if (i === -1) continue;

    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

const env = loadEnv();

const API_URL = (env.API_URL || "").replace(/\/+$/, "");
const API_KEY = env.API_KEY || "";

const DEFAULT_DOWNLOADS = env.DOWNLOADS_DIR || "./downloads";
const TIKTOK_DIR = env.TIKTOK_DIR || path.join(DEFAULT_DOWNLOADS, "TikTok");
const YOUTUBE_DIR = env.YOUTUBE_DIR || path.join(DEFAULT_DOWNLOADS, "YouTube");
const INSTAGRAM_DIR = env.INSTAGRAM_DIR || path.join(DEFAULT_DOWNLOADS, "Instagram");
const UNKNOWN_DIR = env.UNKNOWN_DIR || path.join(DEFAULT_DOWNLOADS, "Outros");

function detectSource(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");

    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "TikTok";
    if (host === "youtube.com" || host === "youtu.be" || host.endsWith(".youtube.com")) return "YouTube";
    if (host === "instagram.com" || host.endsWith(".instagram.com")) return "Instagram";
    return "Outros";
  } catch {
    return "Inválido";
  }
}

function getDestination(source) {
  if (source === "TikTok") return TIKTOK_DIR;
  if (source === "YouTube") return YOUTUBE_DIR;
  if (source === "Instagram") return INSTAGRAM_DIR;
  return UNKNOWN_DIR;
}

function extensionFromContentType(contentType = "") {
  const type = contentType.split(";")[0].trim().toLowerCase();

  const map = {
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/webm": ".webm",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
  };

  return map[type] || ".bin";
}

function filenameFromDisposition(header) {
  if (!header) return null;

  const utf = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf) {
    try {
      return decodeURIComponent(utf[1].replace(/^["']|["']$/g, ""));
    } catch {}
  }

  const normal = header.match(/filename="?([^"]+)"?/i);
  return normal ? normal[1].trim() : null;
}

function sanitizeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function makeFallbackFilename(source, contentType) {
  const ext = extensionFromContentType(contentType);
  return `${source.toLowerCase()}-${Date.now()}${ext}`;
}

function uniquePath(filePath) {
  if (!fs.existsSync(filePath)) return filePath;

  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const stem = path.basename(filePath, ext);

  let n = 2;
  while (fs.existsSync(path.join(dir, `${stem}-${n}${ext}`))) n++;

  return path.join(dir, `${stem}-${n}${ext}`);
}

function ensureConfig() {
  if (!API_URL || !API_KEY) {
    console.log("\n❌ Configuração incompleta.");
    console.log("Edite o arquivo .env e preencha API_URL e API_KEY.\n");
    return false;
  }

  return true;
}

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function downloadMedia(url, mode = null) {
  const source = detectSource(url);

  if (source === "Inválido") {
    console.log("❌ URL inválida.");
    return;
  }

  console.log(`\n🔎 Fonte identificada: ${source}`);

  if (source === "Outros") {
    console.log("⚠️ A API atual não documenta /download para essa fonte.");
    return;
  }

  const destination = getDestination(source);
  fs.mkdirSync(destination, { recursive: true });

  const body = { url };
  if (source === "YouTube" && mode) body.mode = mode;

  console.log("📡 Enviando para a API...");

  const response = await fetch(`${API_URL}/download`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorText = "";
    try {
      errorText = await response.text();
    } catch {}

    console.log(`❌ API respondeu HTTP ${response.status}.`);
    if (errorText) console.log(`   ${errorText.slice(0, 500)}`);
    return;
  }

  const contentType = response.headers.get("content-type") || "";
  const disposition = response.headers.get("content-disposition");

  let filename = filenameFromDisposition(disposition);

  if (!filename) {
    filename = makeFallbackFilename(source, contentType);
  }

  filename = sanitizeFilename(filename);

  if (!path.extname(filename)) {
    filename += extensionFromContentType(contentType);
  }

  const output = uniquePath(path.join(destination, filename));

  console.log(`📁 Destino: ${output}`);
  console.log("⬇️ Baixando...");

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(output, buffer);

  const mb = (buffer.length / 1024 / 1024).toFixed(2);
  console.log(`✅ Concluído: ${mb} MiB`);
  console.log(`   ${output}\n`);
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  if (!ensureConfig()) {
    rl.close();
    process.exit(1);
  }

  console.clear();

  while (true) {
    console.log("╔══════════════════════════════════════╗");
    console.log("║       🐢 MELISSA DOWNLOADER CLI      ║");
    console.log("╠══════════════════════════════════════╣");
    console.log("║ 1. Baixar mídia                      ║");
    console.log("║ 2. Ver configurações                 ║");
    console.log("║ 0. Sair                              ║");
    console.log("╚══════════════════════════════════════╝");

    const option = (await ask(rl, "\nEscolha: ")).trim();

    if (option === "0") break;

    if (option === "2") {
      console.log("\n⚙️ Configurações:");
      console.log(`API: ${API_URL}`);
      console.log(`Downloads: ${DEFAULT_DOWNLOADS}`);
      console.log(`TikTok: ${TIKTOK_DIR}`);
      console.log(`YouTube: ${YOUTUBE_DIR}`);
      console.log(`Instagram: ${INSTAGRAM_DIR}`);
      console.log(`Outros: ${UNKNOWN_DIR}\n`);
      continue;
    }

    if (option === "1") {
      const url = (await ask(rl, "\n🔗 URL: ")).trim();

      const source = detectSource(url);
      let mode = null;

      if (source === "YouTube") {
        const selected = (await ask(
          rl,
          "🎵 YouTube: [1] vídeo  [2] áudio  (Enter = vídeo): "
        )).trim();

        if (selected === "2") mode = "audio";
        else mode = "video";
      }

      try {
        await downloadMedia(url, mode);
      } catch (error) {
        console.log(`\n❌ Erro: ${error.message}`);
      }

      continue;
    }

    console.log("\n❌ Opção inválida.\n");
  }

  rl.close();
  console.log("\n👋 Até mais, gatinha! 🐢");
}

main().catch(error => {
  console.error(`\n❌ Erro fatal: ${error.message}`);
  process.exit(1);
});
