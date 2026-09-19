const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const context = {
  globalThis: {}
};
context.globalThis = context;
vm.createContext(context);

for (const file of ["sources.js", "questions.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

const sources = context.SOFT_TENNIS_REFEREE_SOURCES;
const questions = context.SOFT_TENNIS_REFEREE_QUESTIONS;
const categories = context.SOFT_TENNIS_REFEREE_QUESTION_CATEGORIES;
const sourceIds = new Set(sources.map((source) => source.id));
const ids = new Set();
const prompts = new Set();
const categoryCounts = {};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(Array.isArray(sources) && sources.length >= 5, "sources should include official and federation references");
assert(Array.isArray(questions), "questions should be exported");
assert(questions.length === 108, `expected 108 unique reviewed questions, got ${questions.length}`);
assert(Array.isArray(categories) && categories.includes("スコアシート・審判動作"), "category list should use スコアシート");
assert(!categories.includes("採点票・審判動作"), "old 採点票 category should not remain");

for (const source of sources) {
  for (const field of ["id", "rank", "title", "publisher", "url", "checkedAt", "scopeNote"]) {
    assert(source[field], `source ${source.id || "(missing id)"} missing ${field}`);
  }
  assert(["A", "B", "C"].includes(source.rank), `source ${source.id} has invalid rank`);
}

const heatSource = sources.find((source) => source.id === "jsta-heat-rule");
assert(heatSource && heatSource.rank === "B", "2021 heat-rule page is superseded and should not rank above the 2026 rulebook");

for (const question of questions) {
  assert(!ids.has(question.id), `duplicate question id: ${question.id}`);
  ids.add(question.id);
  assert(!prompts.has(question.prompt), `duplicate prompt: ${question.prompt}`);
  prompts.add(question.prompt);
  for (const field of [
    "id",
    "category",
    "prompt",
    "choices",
    "answerId",
    "officialTerm",
    "plainExplanation",
    "sourceRefs",
    "sourceRank",
    "scopeNote",
    "lastVerified",
    "reviewStatus"
  ]) {
    assert(question[field], `question ${question.id} missing ${field}`);
  }
  assert(question.reviewStatus === "reviewed", `question ${question.id} should be reviewed`);
  assert(question.choices.length === 4, `question ${question.id} should have 4 choices`);
  const answer = question.choices.find((choice) => choice.id === question.answerId);
  assert(answer, `question ${question.id} answerId missing`);
  assert(question.sourceRefs.every((sourceId) => sourceIds.has(sourceId)), `question ${question.id} has unknown source`);
  assert(categories.includes(question.category), `question ${question.id} has unknown category`);
  assert(!/^(ドリル|実際の試合で|もう一度確認|初心者へ説明するなら|振り返り):/.test(question.prompt), `question ${question.id} should not be a prefix clone`);
  assert(!question.prompt.includes("アンパイヤー"), `question ${question.id} should use アンパイア`);
  assert(!question.plainExplanation.includes("アンパイヤー"), `question ${question.id} explanation should use アンパイア`);
  assert(!question.choices.some((choice) => choice.text.includes("アンパイヤー")), `question ${question.id} choices should use アンパイア`);
  categoryCounts[question.category] = (categoryCounts[question.category] || 0) + 1;

  if (question.category === "2026年コイントス運用") {
    assert(question.effectiveFrom, `coin toss question ${question.id} missing effectiveFrom`);
    assert(question.scopeNote, `coin toss question ${question.id} missing scopeNote`);
    assert(question.sourceRefs.includes("jsta-coin-toss-2026"), `coin toss question ${question.id} missing JSTA source`);
  }

  if (/名前は？|何と呼ぶ？|規則の呼び方は？|名称は？/.test(question.prompt)) {
    assert(
      answer.text === question.officialTerm || answer.text.includes(question.officialTerm),
      `term question ${question.id} answer "${answer.text}" should match officialTerm "${question.officialTerm}"`
    );
  }

  const linked = [answer.text, question.plainExplanation, question.prompt].join("");
  assert(
    linked.includes(question.officialTerm) || question.officialTerm.length <= 2,
    `question ${question.id} officialTerm should appear in the prompt, answer, or explanation`
  );
}

assert(categoryCounts["2026年コイントス運用"] === 3, "coin toss questions should stay at 3");
assert(categoryCounts["ヒートルール"] === 3, "heat rule questions should stay at 3");
assert(categoryCounts["スコア"] >= 10, "score category should have a real unique set");
assert(categoryCounts["サービス/レシーブ"] >= 10, "serve category should have a real unique set");
assert(categoryCounts["失ポイント"] >= 10, "fault category should have a real unique set");
assert(!questions.some((question) => question.officialTerm === "ツーバウンド"), "official call is ツーバウンズ");
assert(questions.some((question) => question.officialTerm === "ツーバウンズ"), "ツーバウンズ question should exist");
assert(questions.some((question) => question.officialTerm === "スルー"), "スルー question should exist");
assert(questions.some((question) => question.id === "heat-01" && question.choices.some((choice) => choice.text.includes("気温35℃"))), "heat-rule question should contrast the old 35°C wording as a wrong choice");

const sourceText = ["index.html", "styles.css", "app.js", "questions.js"]
  .map((file) => fs.readFileSync(path.join(root, file), "utf8"))
  .join("\n");

assert(!sourceText.includes("🎾"), "hard-tennis-style tennis ball emoji must not be used");
assert(!/tennis-ball|hard tennis|硬式テニスボール|フェルト/.test(sourceText), "hard tennis ball wording should not appear in UI source");
assert(!/court-visual|visual-ball|ball-trail|coin-disc|plain-ball/.test(sourceText), "old court or ball visual classes should not return");
assert(!/A: |B: |C: |出典ランク/.test(sourceText), "source rank should not be shown to beginner users");
assert(!/試験|模擬/.test(sourceText), "exam wording should not appear in the drill app UI source");
assert(!/参考にした資料|公式資料・連盟資料を確認して作成|source-list|source-panel/.test(sourceText), "source references should stay out of the app UI");
assert(!fs.readFileSync(path.join(root, "index.html"), "utf8").includes("sources.js"), "sources.js should not be loaded by the app page");

console.log(`OK: ${questions.length} unique questions, ${sources.length} sources`);
console.log(JSON.stringify(categoryCounts));
