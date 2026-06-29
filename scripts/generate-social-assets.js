const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "assets", "social");

const colors = {
  bg: "#eef7f2",
  bg2: "#d9f0e6",
  green: "#0e9d62",
  greenDark: "#0a7a4b",
  ink: "#122a3d",
  muted: "#5d7184",
  coral: "#ee4d54",
  amber: "#f5b939",
  white: "#ffffff",
  blueSoft: "#dfeaff"
};

const font = `"Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif`;

const assets = [
  {
    file: "x-facebook-card",
    width: 1200,
    height: 630,
    title: "ソフテニルールドリル",
    subtitle: "はじめてのルールを10問ずつ",
    note: "スマホで4択ドリル・記録・振り返り",
    url: "公開中のWebアプリ",
    variant: "wide"
  },
  {
    file: "instagram-square",
    width: 1080,
    height: 1080,
    title: "ソフテニルールドリル",
    subtitle: "親子で基本ルール",
    note: "1セット10問 / 4択ドリル / 記録つき",
    url: "公開中",
    variant: "square"
  },
  {
    file: "instagram-story",
    width: 1080,
    height: 1920,
    title: "ソフトテニスを始めたら",
    subtitle: "10問ずつルール確認",
    note: "子どもと保護者向けの4択ドリル",
    url: "ソフテニルールドリル",
    variant: "story"
  },
  {
    file: "note-header",
    width: 1600,
    height: 900,
    title: "ソフテニルールドリル",
    subtitle: "始めたばかりの子どもと保護者へ",
    note: "基本ルールを、短く・やさしく・くり返し確認",
    url: "公開中のWebアプリ",
    variant: "wide"
  }
];

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function logo(x, y, size) {
  const r = size * 0.24;
  const cardX = x + size * 0.24;
  const cardY = y + size * 0.18;
  const cardW = size * 0.52;
  const cardH = size * 0.64;
  return `
    <g transform="translate(${x} ${y})">
      <rect width="${size}" height="${size}" rx="${r}" fill="url(#logoBg)"/>
      <rect x="${cardX - x}" y="${cardY - y}" width="${cardW}" height="${cardH}" rx="${size * 0.08}" fill="${colors.white}"/>
      <rect x="${size * 0.31}" y="${size * 0.27}" width="${size * 0.38}" height="${size * 0.07}" rx="${size * 0.035}" fill="${colors.bg2}"/>
      <rect x="${size * 0.31}" y="${size * 0.44}" width="${size * 0.38}" height="${size * 0.045}" rx="${size * 0.022}" fill="${colors.blueSoft}"/>
      <rect x="${size * 0.31}" y="${size * 0.56}" width="${size * 0.33}" height="${size * 0.045}" rx="${size * 0.022}" fill="${colors.amber}"/>
      <rect x="${size * 0.61}" y="${size * 0.59}" width="${size * 0.18}" height="${size * 0.18}" rx="${size * 0.045}" fill="${colors.greenDark}"/>
      <path d="M ${size * 0.65} ${size * 0.68} l ${size * 0.035} ${size * 0.04} l ${size * 0.075} ${-size * 0.105}" fill="none" stroke="${colors.white}" stroke-width="${size * 0.035}" stroke-linecap="round" stroke-linejoin="round"/>
    </g>`;
}

function statCard(x, y, w, h, label, value, accent) {
  return `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(28, h * 0.2)}" fill="${colors.white}" stroke="#dcebe4" stroke-width="2"/>
      <text x="${x + w * 0.12}" y="${y + h * 0.38}" fill="${colors.muted}" font-size="${h * 0.2}" font-weight="800">${esc(label)}</text>
      <text x="${x + w * 0.12}" y="${y + h * 0.76}" fill="${accent}" font-size="${h * 0.34}" font-weight="900">${esc(value)}</text>
    </g>`;
}

function featurePill(x, y, text, width) {
  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="58" rx="29" fill="${colors.white}" stroke="#dcebe4" stroke-width="2"/>
      <circle cx="${x + 34}" cy="${y + 29}" r="10" fill="${colors.green}"/>
      <text x="${x + 58}" y="${y + 38}" fill="${colors.ink}" font-size="25" font-weight="800">${esc(text)}</text>
    </g>`;
}

function background(width, height) {
  return `
    <rect width="${width}" height="${height}" fill="${colors.bg}"/>
    <circle cx="${width * 0.92}" cy="${height * 0.02}" r="${width * 0.32}" fill="${colors.bg2}" opacity="0.72"/>
    <circle cx="${width * 0.08}" cy="${height * 0.95}" r="${width * 0.26}" fill="#ffffff" opacity="0.58"/>
    <path d="M ${width * 0.08} ${height * 0.18} C ${width * 0.23} ${height * 0.08}, ${width * 0.36} ${height * 0.16}, ${width * 0.5} ${height * 0.08}" fill="none" stroke="${colors.green}" stroke-width="10" stroke-linecap="round" opacity="0.18"/>
  `;
}

function wide(asset) {
  const { width, height } = asset;
  return `
    ${logo(80, 80, 132)}
    <text x="245" y="118" fill="${colors.greenDark}" font-size="34" font-weight="900">公開中のWebアプリ</text>
    <text x="80" y="294" fill="${colors.ink}" font-size="72" font-weight="900">${esc(asset.title)}</text>
    <text x="84" y="374" fill="${colors.greenDark}" font-size="43" font-weight="900">${esc(asset.subtitle)}</text>
    <text x="86" y="432" fill="${colors.muted}" font-size="30" font-weight="700">${esc(asset.note)}</text>
    ${featurePill(80, 493, "1セット10問", 250)}
    ${featurePill(352, 493, "4択ドリル", 240)}
    ${featurePill(614, 493, "記録つき", 220)}
    <rect x="${width - 358}" y="74" width="278" height="280" rx="42" fill="${colors.white}" stroke="#dcebe4" stroke-width="2"/>
    ${statCard(width - 328, 105, 218, 86, "回答", "10問", colors.greenDark)}
    ${statCard(width - 328, 207, 218, 86, "形式", "4択", colors.coral)}
    <text x="${width - 358}" y="${height - 70}" fill="${colors.muted}" font-size="24" font-weight="800">${esc(asset.url)}</text>
  `;
}

function square(asset) {
  return `
    ${logo(82, 82, 148)}
    <text x="260" y="145" fill="${colors.greenDark}" font-size="36" font-weight="900">公開中</text>
    <text x="82" y="356" fill="${colors.ink}" font-size="75" font-weight="900">${esc(asset.title)}</text>
    <text x="86" y="442" fill="${colors.greenDark}" font-size="48" font-weight="900">${esc(asset.subtitle)}</text>
    <text x="88" y="510" fill="${colors.muted}" font-size="31" font-weight="800">${esc(asset.note)}</text>
    <rect x="82" y="602" width="916" height="282" rx="44" fill="${colors.white}" stroke="#dcebe4" stroke-width="3"/>
    ${statCard(132, 652, 232, 150, "1セット", "10問", colors.greenDark)}
    ${statCard(424, 652, 232, 150, "問題数", "150", colors.coral)}
    ${statCard(716, 652, 232, 150, "形式", "4択", colors.amber)}
    <text x="86" y="960" fill="${colors.muted}" font-size="29" font-weight="800">スマホ・タブレットで使えます</text>
  `;
}

function story(asset) {
  return `
    ${logo(84, 112, 166)}
    <text x="84" y="400" fill="${colors.ink}" font-size="72" font-weight="900">${esc(asset.title)}</text>
    <text x="86" y="498" fill="${colors.greenDark}" font-size="58" font-weight="900">${esc(asset.subtitle)}</text>
    <text x="88" y="575" fill="${colors.muted}" font-size="34" font-weight="800">${esc(asset.note)}</text>
    <rect x="84" y="725" width="912" height="548" rx="54" fill="${colors.white}" stroke="#dcebe4" stroke-width="3"/>
    <text x="144" y="850" fill="${colors.ink}" font-size="47" font-weight="900">今日のセット</text>
    <text x="144" y="1015" fill="${colors.greenDark}" font-size="120" font-weight="900">10問</text>
    <text x="144" y="1110" fill="${colors.muted}" font-size="35" font-weight="800">短い時間で、くり返し確認</text>
    ${featurePill(144, 1160, "4択で答える", 300)}
    ${featurePill(474, 1160, "記録を見る", 290)}
    <rect x="84" y="1420" width="912" height="200" rx="44" fill="${colors.greenDark}"/>
    <text x="144" y="1512" fill="${colors.white}" font-size="42" font-weight="900">ソフテニルールドリル</text>
    <text x="144" y="1580" fill="#d9f0e6" font-size="30" font-weight="800">公開中のWebアプリ</text>
  `;
}

function svg(asset) {
  const body = asset.variant === "square" ? square(asset) : asset.variant === "story" ? story(asset) : wide(asset);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${asset.width}" height="${asset.height}" viewBox="0 0 ${asset.width} ${asset.height}">
  <defs>
    <linearGradient id="logoBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${colors.green}"/>
      <stop offset="1" stop-color="${colors.greenDark}"/>
    </linearGradient>
    <style>
      text { font-family: ${font}; letter-spacing: 0; }
    </style>
  </defs>
  ${background(asset.width, asset.height)}
  ${body}
</svg>
`;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  for (const asset of assets) {
    const svgText = svg(asset);
    const svgPath = path.join(outDir, `${asset.file}.svg`);
    const pngPath = path.join(outDir, `${asset.file}.png`);
    fs.writeFileSync(svgPath, svgText);
    await sharp(Buffer.from(svgText)).png().toFile(pngPath);
    console.log(`generated ${path.relative(root, svgPath)} and ${path.relative(root, pngPath)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
