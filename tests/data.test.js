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
const sourceIds = new Set(sources.map((source) => source.id));
const ids = new Set();
const categoryCounts = {};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(Array.isArray(sources) && sources.length >= 5, "sources should include official and federation references");
assert(Array.isArray(questions), "questions should be exported");
assert(questions.length === 150, `expected 150 reviewed questions, got ${questions.length}`);

for (const source of sources) {
  for (const field of ["id", "rank", "title", "publisher", "url", "checkedAt", "scopeNote"]) {
    assert(source[field], `source ${source.id || "(missing id)"} missing ${field}`);
  }
  assert(["A", "B", "C"].includes(source.rank), `source ${source.id} has invalid rank`);
}

for (const question of questions) {
  assert(!ids.has(question.id), `duplicate question id: ${question.id}`);
  ids.add(question.id);
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
  assert(question.choices.some((choice) => choice.id === question.answerId), `question ${question.id} answerId missing`);
  assert(question.sourceRefs.every((sourceId) => sourceIds.has(sourceId)), `question ${question.id} has unknown source`);
  categoryCounts[question.category] = (categoryCounts[question.category] || 0) + 1;

  if (question.category === "2026年コイントス運用") {
    assert(question.effectiveFrom, `coin toss question ${question.id} missing effectiveFrom`);
    assert(question.scopeNote, `coin toss question ${question.id} missing scopeNote`);
    assert(question.sourceRefs.includes("jsta-coin-toss-2026"), `coin toss question ${question.id} missing JSTA source`);
  }
}

assert(categoryCounts["2026年コイントス運用"] <= 3, "coin toss questions should stay light for beginners");
assert(categoryCounts["ヒートルール"] <= 3, "heat rule questions should stay light for beginners");

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

console.log(`OK: ${questions.length} questions, ${sources.length} sources`);
