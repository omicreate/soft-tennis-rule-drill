(() => {
  const STORAGE_KEY = "soft-tennis-rule-drill-progress-v1";
  const DRILL_SET_SIZE = 10;

  const questions = globalThis.SOFT_TENNIS_REFEREE_QUESTIONS || [];
  const categories = globalThis.SOFT_TENNIS_REFEREE_QUESTION_CATEGORIES || [];
  const questionMap = new Map(questions.map((question) => [question.id, question]));

  const state = {
    tab: "quiz",
    drillSet: [],
    drillIndex: 0,
    setCorrect: 0,
    setFinished: false,
    currentQuestion: null,
    selectedAnswerId: "",
    progress: loadProgress()
  };

  const viewRoot = document.querySelector("#viewRoot");
  const navButtons = [...document.querySelectorAll(".nav-button")];

  function defaultProgress() {
    return {
      answers: {},
      streak: 0,
      bestStreak: 0,
      totalAnswered: 0,
      totalCorrect: 0,
      lastStudyAt: "",
      reviewQueue: [],
      drillSeenIds: [],
      drillSeenKeys: []
    };
  }

  function loadProgress() {
    try {
      return { ...defaultProgress(), ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
    } catch {
      return defaultProgress();
    }
  }

  function saveProgress() {
    state.progress.lastStudyAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
  }

  function shuffle(items) {
    const cloned = [...items];
    for (let i = cloned.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
    }
    return cloned;
  }

  function reviewedQuestions() {
    return questions.filter((question) => question.reviewStatus === "reviewed");
  }

  function normalizeQuestion(question) {
    return {
      ...question,
      choices: shuffle(question.choices)
    };
  }

  function startDrillSet(category = "") {
    const set = buildDrillSet(category);
    state.drillSet = set.map((question) => question.id);
    state.drillIndex = 0;
    state.setCorrect = 0;
    state.setFinished = set.length === 0;
    state.currentQuestion = set.length ? normalizeQuestion(set[0]) : null;
    state.selectedAnswerId = "";
  }

  function buildDrillSet(category = "") {
    const allQuestions = reviewedQuestions().filter((question) => !category || question.category === category);
    const seenIds = new Set(state.progress.drillSeenIds || []);
    const seenKeys = new Set(state.progress.drillSeenKeys || []);
    let pool = allQuestions.filter((question) => !seenIds.has(question.id) && !seenKeys.has(displayKey(question)));
    if (pool.length === 0) {
      state.progress.drillSeenIds = category
        ? (state.progress.drillSeenIds || []).filter((id) => questionMap.get(id)?.category !== category)
        : [];
      state.progress.drillSeenKeys = category
        ? (state.progress.drillSeenKeys || []).filter((key) => {
            const source = reviewedQuestions().find((question) => displayKey(question) === key);
            return !source || source.category !== category;
          })
        : [];
      pool = allQuestions;
    }
    return selectBalancedQuestions(pool, Math.min(DRILL_SET_SIZE, pool.length));
  }

  function selectBalancedQuestions(pool, size) {
    const buckets = new Map();
    for (const question of shuffle(pool)) {
      const bucket = buckets.get(question.category) || [];
      bucket.push(question);
      buckets.set(question.category, bucket);
    }
    let categoryOrder = shuffle(categories.filter((category) => buckets.has(category)));
    const selected = [];
    const selectedKeys = new Set();
    let cursor = 0;
    while (selected.length < size && categoryOrder.length > 0) {
      const category = categoryOrder[cursor % categoryOrder.length];
      const bucket = buckets.get(category) || [];
      const next = bucket.shift();
      if (next && !selectedKeys.has(displayKey(next))) {
        selected.push(next);
        selectedKeys.add(displayKey(next));
      }
      if (bucket.length === 0) {
        categoryOrder = categoryOrder.filter((item) => item !== category);
        cursor = 0;
      } else {
        cursor += 1;
      }
    }
    return selected;
  }

  function nextQuestion() {
    if (state.drillIndex >= state.drillSet.length - 1) {
      state.setFinished = true;
      state.currentQuestion = null;
      state.selectedAnswerId = "";
      render();
      return;
    }
    state.drillIndex += 1;
    state.currentQuestion = normalizeQuestion(questionMap.get(state.drillSet[state.drillIndex]));
    state.selectedAnswerId = "";
  }

  function answerQuestion(answerId) {
    if (!state.currentQuestion || state.selectedAnswerId) return;
    const question = state.currentQuestion;
    const correct = answerId === question.answerId;
    state.selectedAnswerId = answerId;
    state.setCorrect += correct ? 1 : 0;
    state.progress.totalAnswered += 1;
    state.progress.totalCorrect += correct ? 1 : 0;
    state.progress.streak = correct ? state.progress.streak + 1 : 0;
    state.progress.bestStreak = Math.max(state.progress.bestStreak, state.progress.streak);
    const item = state.progress.answers[question.id] || {
      attempts: 0,
      correct: 0,
      wrongCount: 0,
      lastAnsweredAt: "",
      mastered: false
    };
    item.attempts += 1;
    item.correct += correct ? 1 : 0;
    item.wrongCount += correct ? 0 : 1;
    item.lastAnsweredAt = new Date().toISOString();
    item.mastered = item.attempts >= 2 && item.correct / item.attempts >= 0.8;
    state.progress.answers[question.id] = item;
    state.progress.reviewQueue = correct
      ? state.progress.reviewQueue.filter((id) => id !== question.id)
      : [question.id, ...state.progress.reviewQueue.filter((id) => id !== question.id)].slice(0, 60);
    state.progress.drillSeenIds = [question.id, ...(state.progress.drillSeenIds || []).filter((id) => id !== question.id)]
      .filter((id) => questionMap.has(id))
      .slice(0, reviewedQuestions().length);
    state.progress.drillSeenKeys = [displayKey(question), ...(state.progress.drillSeenKeys || []).filter((key) => key !== displayKey(question))]
      .slice(0, reviewedQuestions().length);
    saveProgress();
    render();
  }

  function categoryStats(questionSet = reviewedQuestions(), answerMap = null) {
    return categories.map((category) => {
      const items = questionSet.filter((question) => question.category === category);
      const answered = items.filter((question) => {
        if (answerMap) return Object.hasOwn(answerMap, question.id);
        return Boolean(state.progress.answers[question.id]);
      });
      const correct = items.filter((question) => {
        if (answerMap) return answerMap[question.id] === question.answerId;
        return (state.progress.answers[question.id]?.correct || 0) > 0;
      });
      return {
        category,
        total: items.length,
        answered: answered.length,
        correct: correct.length,
        rate: items.length ? Math.round((correct.length / items.length) * 100) : 0
      };
    });
  }

  function masteryRate() {
    const total = reviewedQuestions().length || 1;
    const mastered = Object.values(state.progress.answers).filter((item) => item.mastered).length;
    return Math.round((mastered / total) * 100);
  }

  function updateStatus() {
    const correct = state.progress.totalCorrect;
    const wrong = Math.max(0, state.progress.totalAnswered - correct);
    document.querySelector("#correctValue").textContent = correct;
    document.querySelector("#wrongValue").textContent = wrong;
    document.querySelector("#streakValue").textContent = state.progress.streak;
  }

  function setActiveTab() {
    navButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === state.tab);
    });
  }

  function renderCourtIllustration(question) {
    const coinMode = question?.category === "2026年コイントス運用";
    return `
      <div class="drill-visual ${coinMode ? "coin-mode" : ""}" aria-hidden="true">
        <div class="visual-board">
          <span class="visual-chip">4択</span>
          <strong>${coinMode ? "試合前の確認" : "基本ルール"}</strong>
          <small>${coinMode ? "大会のきまりを見てから進める" : "場面をえらんで覚える"}</small>
        </div>
        <div class="visual-choice-list">
          <span></span>
          <span></span>
          <span class="is-selected"></span>
        </div>
        <div class="visual-check">✓</div>
      </div>
    `;
  }

  function renderQuiz() {
    if (!state.currentQuestion && !state.setFinished) startDrillSet();
    if (state.setFinished) {
      renderSetComplete();
      return;
    }
    const question = state.currentQuestion;
    const selected = state.selectedAnswerId;
    const isCorrect = selected && selected === question.answerId;
    const progressText = `${state.drillIndex + 1}/${state.drillSet.length}`;
    const progressRate = ((state.drillIndex + (selected ? 1 : 0)) / state.drillSet.length) * 100;
    viewRoot.innerHTML = `
      <section class="quiz-panel">
        <div class="quiz-meta">
          <span>今日のセット</span>
          <strong>${escapeHtml(progressText)}</strong>
        </div>
        <div class="progress-track"><span class="${widthClass(progressRate)}"></span></div>
        ${renderCourtIllustration(question)}
        <div class="question-card">
          <p class="question-id">ことば: ${escapeHtml(displayTerm(question))}</p>
          <h2>${escapeHtml(displayPrompt(question))}</h2>
          <p class="question-helper">場面を思いうかべて、いちばん正しいものをえらぼう。</p>
          <div class="choice-list">
            ${question.choices
              .map((choice, index) => {
                const correctClass = selected && choice.id === question.answerId ? "correct" : "";
                const wrongClass = selected === choice.id && choice.id !== question.answerId ? "wrong" : "";
                return `<button class="choice-button ${correctClass} ${wrongClass}" type="button" data-answer="${escapeAttr(choice.id)}" ${selected ? "disabled" : ""}>
                  <span class="choice-number">${index + 1}</span>
                  <span>${escapeHtml(displayChoiceText(choice.text))}</span>
                </button>`;
              })
              .join("")}
          </div>
        </div>
        ${
          selected
            ? `<section class="answer-card ${isCorrect ? "is-correct" : "is-wrong"}">
                <strong>${isCorrect ? "正解。ナイスジャッジ！" : "もう一度確認しよう"}</strong>
                <p><b>${escapeHtml(question.officialTerm)}</b> / ${escapeHtml(question.plainExplanation)}</p>
                <button class="primary-action" id="nextQuestionButton" type="button">${state.drillIndex >= state.drillSet.length - 1 ? "結果を見る" : "次の問題へ"}</button>
              </section>`
            : `<p class="hint-line">選ぶと、正しいことばと短い説明が出ます。</p>`
        }
      </section>
    `;
  }

  function renderSetComplete() {
    viewRoot.innerHTML = `
      <section class="complete-panel">
        <div class="complete-card">
          <span>1セット完了</span>
          <h2>${state.setCorrect}/${state.drillSet.length} 正解</h2>
          <p>${escapeHtml(setCompleteMessage())}</p>
          <button class="primary-action wide" id="startNextSetButton" type="button">次の10問へ</button>
          <button class="ghost-action wide" id="goReviewButton" type="button">振り返りを見る</button>
        </div>
      </section>
    `;
  }

  function renderReview() {
    const stats = categoryStats();
    const reviewItems = state.progress.reviewQueue
      .map((id) => questions.find((question) => question.id === id))
      .filter(Boolean)
      .slice(0, 8);
    viewRoot.innerHTML = `
      <section class="learn-panel">
        <div class="section-heading">
          <h2>振り返り</h2>
          <p>${escapeHtml(reviewMessage())}</p>
        </div>
        <section class="review-list">
          <h2>もう一度やる問題</h2>
          ${
            reviewItems.length
              ? reviewItems.map((item) => `<button type="button" data-review="${escapeAttr(item.id)}">${escapeHtml(displayTerm(item))}: ${escapeHtml(displayPrompt(item))}</button>`).join("")
              : "<p>まだ復習問題はありません。間違えた問題がここに入ります。</p>"
          }
        </section>
        <h3 class="subsection-title">ジャンル別の進み具合</h3>
        <div class="category-grid">
          ${stats
            .map(
              (item) => `<button class="category-card" type="button" data-category="${escapeAttr(item.category)}">
                <span>${escapeHtml(displayCategoryName(item.category))}</span>
                <strong>${item.correct}/${item.total}</strong>
                <small>${escapeHtml(displayCategoryHint(item.category))}</small>
              </button>`
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function renderRecord() {
    const total = state.progress.totalAnswered || 0;
    const accuracy = total ? Math.round((state.progress.totalCorrect / total) * 100) : 0;
    const stats = categoryStats();
    viewRoot.innerHTML = `
      <section class="record-panel">
        <div class="motivation-card">
          <strong>いいペースです</strong>
          <p>${escapeHtml(recordMessage(total, accuracy))}</p>
        </div>
        <div class="record-summary">
          <div><span>回答数</span><strong>${total}</strong></div>
          <div><span>正答率</span><strong>${accuracy}%</strong></div>
          <div><span>最高連続</span><strong>${state.progress.bestStreak}</strong></div>
        </div>
        <div class="mini-note">習熟度 ${masteryRate()}% / 最終学習 ${escapeHtml(formatStudyDate(state.progress.lastStudyAt))}</div>
        <div class="category-bars">
          ${stats
            .map((item) => `<div class="bar-row">
              <span>${escapeHtml(displayCategoryName(item.category))}</span>
              <div><span class="${widthClass(item.rate)}"></span></div>
              <strong>${item.rate}%</strong>
            </div>`)
            .join("")}
        </div>
        <button class="ghost-action wide" id="resetProgressButton" type="button">学習記録をリセット</button>
      </section>
    `;
  }

  function render() {
    updateStatus();
    setActiveTab();
    if (state.tab === "review") renderReview();
    if (state.tab === "quiz") renderQuiz();
    if (state.tab === "record") renderRecord();
  }

  function setCompleteMessage() {
    if (state.setCorrect === state.drillSet.length) return "満点です。今日のルール確認はばっちりです。";
    if (state.setCorrect >= Math.ceil(state.drillSet.length * 0.7)) return "かなりいい感じです。迷った問題だけ見直せば、もっと安心です。";
    return "ここまで進めたことが大事です。まちがえた問題は、次に覚えるチャンスです。";
  }

  function reviewMessage() {
    if ((state.progress.reviewQueue || []).length === 0) return "今は復習リストが空です。まずは1セット、気軽にやってみましょう。";
    return "まちがいは弱点ではなく、次に分かるようになる場所です。少しずつ確認していきましょう。";
  }

  function recordMessage(total, accuracy) {
    if (total === 0) return "まずは10問だけで大丈夫。親子で話しながら始められます。";
    if (accuracy >= 80) return "よく覚えています。次は試合の場面を思い浮かべながら進めてみましょう。";
    if (accuracy >= 50) return "少しずつ分かることが増えています。続けるほど、試合を見るのも楽になります。";
    return "最初は知らない言葉が多くて普通です。1セットずつ進めれば十分です。";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function displayPrompt(question) {
    const baseText = stripScenarioPrefix(question.prompt);
    const normalized = baseText
      .replace("一般的に", "")
      .replace("自然なのは？", "どれ？")
      .replace("近いものは？", "どれ？")
      .replace("近い扱いは？", "どうなる？")
      .replace("確認したい扱いは？", "どう考える？")
      .replace("関係する用語は？", "この名前は？")
      .replace("意識することは？", "気をつけることは？")
      .replace("よい対応は？", "どうするとよい？")
      .replace("よい態度は？", "どうするとよい？")
      .replace("改善としてよいものは？", "どう直す？")
      .replace("主なコールは？", "何とコールする？")
      .replace("どう扱う？", "どうなる？");

    const easyPrompts = {
      "通常ゲームで、先に4ポイントを取り2ポイント差がついた。どうなる？":
        "4ポイントを取って、相手より2ポイント多くなりました。どうなる？",
      "ファイナルゲームで目安になる先取ポイントは？":
        "ファイナルゲームは、まず何ポイントを目指す？",
      "ポイントが同点でゲーム終盤に追いついた場面。審判が特に確認したいことは？":
        "ゲームの終わりごろで同点です。審判は何を確認する？",
      "7ゲームマッチで勝敗が決まるゲーム取得数は？":
        "7ゲームマッチは、何ゲーム取ると勝ち？",
      "5ゲームマッチで勝敗が決まるゲーム取得数は？":
        "5ゲームマッチは、何ゲーム取ると勝ち？",
      "得点後に次のサービスへ進む前、主審が確認することは？":
        "1点が終わりました。次のサービス前に何を確認する？",
      "サービスがネットに当たって正しいサービスコートに入った。一般的なコールは？":
        "サーブがネットに当たって、正しい場所に入りました。何とコールする？",
      "第1サービスが正しく入らなかった。次は？":
        "1本目のサーブが入りませんでした。次はどうする？",
      "第1サービス、第2サービスとも正しく入らなかった。どうなる？":
        "サーブを2本とも失敗しました。どうなる？",
      "プレー中、別コートのボールが入ってきて危険。主審の対応は？":
        "プレー中に、となりのコートからボールが入ってきました。どうする？",
      "サービスレットとノーカウントの違いとしてどれ？":
        "「レット」と「ノーカウント」のちがいはどれ？",
      "プレー中に審判のコールが明らかに選手のプレーを止めさせた。どう考える？":
        "審判の声で、選手がプレーを止めてしまいました。どう考える？",
      "サービスがネットに触れ、正しいサービスコートに入らなかった。どうなる？":
        "サーブがネットに当たり、正しい場所に入りませんでした。どうなる？",
      "隣のコートから声が聞こえたが、プレーに影響していない。毎回ノーカウントにする？":
        "となりの声が聞こえました。でもプレーには関係なさそうです。毎回やり直す？",
      "やり直しの判断で大切なことは？":
        "やり直しにするか迷った時、何を大切にする？",
      "ノーカウント後の説明としてどれ？":
        "ノーカウントになったら、どう説明する？",
      "サービスレットのあと、基本的に何をする？":
        "サービスレットのあとは、どうする？",
      "打ったボールが相手コートに入らず、ラインの外に落ちた。何とコールする？":
        "打ったボールがラインの外に落ちました。何とコールする？",
      "ボールが地面に2回バウンドしてから返球した。この名前は？":
        "ボールが2回バウンドしてから返しました。この名前は？",
      "プレー中に選手の身体や衣服にボールが触れた。この名前は？":
        "プレー中、ボールが体や服に当たりました。この名前は？",
      "選手やラケットがプレー中にネットへ触れた。この名前は？":
        "プレー中、体やラケットがネットにさわりました。この名前は？",
      "相手のプレーを妨げる行為にこの名前は？":
        "相手のプレーをじゃました時の名前は？",
      "ラケットや体がネットを越えて、相手コート側でボールを打った。この名前は？":
        "ネットをこえて、相手側でボールを打ちました。この名前は？",
      "ボールがラインに少しでも触れているように見える。判定としてどれ？":
        "ボールがラインに少しでもさわって見えました。判定は？",
      "判定を訂正する必要がある時、どうするとよい？":
        "判定をまちがえたと気づいたら、どうする？",
      "審判の声が小さい時、どう直す？":
        "審判の声が小さくて聞こえません。どう直す？",
      "副審が担当ラインでアウトを確認した。基本の役割は？":
        "副審がアウトを見ました。副審はどうする？",
      "判定の声と動作が食い違うとどうなる？":
        "声と手の合図がちがうと、どうなる？",
      "試合開始前に主審が確認したいものは？":
        "試合を始める前、主審は何を確認する？",
      "ゲームが終わった後、次に気をつけることは？":
        "ゲームが終わりました。次に何を確認する？",
      "試合前のトスで決める内容としてどれ？":
        "試合前のトスでは、何を決める？",
      "2026年4月7日のJSTA公式案内で導入が示された試合前の方法は？":
        "2026年の案内で、試合前に使うとされた方法は？",
      "JSTA公式案内で、今後コイントスを実施すると示されている大会は？":
        "JSTAの案内では、どの大会でコイントスを行う？",
      "JSTA公式案内で、都道府県連盟へのコイントス運用はどう示されている？":
        "都道府県連盟にも、コイントスをどうしてほしいと案内している？",
      "ヒートルールが採用されると、ファイナルゲームに入る前に認められる休息は何分間？":
        "暑い日のヒートルール。ファイナルゲーム前の休みは何分？",
      "ヒートルール採用の目安となる、大会当日の気温は？":
        "ヒートルールの目安になる気温は？",
      "気温が測れない時、ヒートルールの目安にする暑さ指数（WBGT）の値は？":
        "気温が測れない時、WBGTはいくつ以上が目安？"
    };

    return easyPrompts[normalized] || normalized;
  }

  function displayKey(question) {
    return `${displayTerm(question)}::${displayPrompt(question)}`.replace(/\s+/g, " ").trim();
  }

  function stripScenarioPrefix(text) {
    return String(text || "").replace(/^(ドリル|実際の試合で|もう一度確認|初心者へ説明するなら|振り返り):\s*/, "");
  }

  function formatStudyDate(value) {
    if (!value) return "まだありません";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "まだありません";
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  function displayCategoryName(category) {
    const names = {
      "スコア": "点数",
      "サービス/レシーブ": "サーブとレシーブ",
      "レット/ノーカウント": "やり直し",
      "失ポイント": "相手の点になる時",
      "コール": "審判の声",
      "試合進行": "試合の進め方",
      "禁止事項/マナー": "やってはいけないこと",
      "採点票・審判動作": "記録と合図",
      "2026年コイントス運用": "試合前のトス",
      "ヒートルール": "暑い日のルール"
    };
    return names[category] || category;
  }

  function displayCategoryHint(category) {
    const hints = {
      "スコア": "カウントやゲーム",
      "サービス/レシーブ": "サーブ前後の確認",
      "レット/ノーカウント": "もう一度やる場面",
      "失ポイント": "ミスや反則の場面",
      "コール": "声の出し方",
      "試合進行": "始め方・進め方",
      "禁止事項/マナー": "安全とフェアプレー",
      "採点票・審判動作": "書き方と手の合図",
      "2026年コイントス運用": "コイントスの確認",
      "ヒートルール": "暑い日の休み方"
    };
    return hints[category] || "確認問題";
  }

  function displayTerm(question) {
    const easyTerms = {
      "ポイントカウント": "点数",
      "試合進行": "試合の進め方",
      "ライン判定": "ラインの判定",
      "サービス順": "サーブの順番",
      "ネットタッチ": "ネットにさわる",
      "ネットオーバー": "ネットをこえる",
      "審判動作": "審判の合図",
      "採点票": "記録用紙",
      "適用大会": "使う大会",
      "順次適用": "少しずつ使う",
      "大会要項": "大会のきまり",
      "公平な進行": "公平に進める",
      "気温基準": "気温の目安",
      "休息場所": "休む場所"
    };
    return easyTerms[question.officialTerm] || question.officialTerm;
  }

  function displayChoiceText(text) {
    const replacements = {
      "そのゲームを取得": "そのゲームの勝ち",
      "もう1ポイント行う": "もう1点行う",
      "ファイナルゲームに入る": "ファイナルゲームへ進む",
      "次の1点で終わるか、差が必要か": "次の1点で終わるか確認",
      "必ずサイドを交替するか": "必ずサイドを替える",
      "試合を最初からやり直すか": "試合をはじめからやり直す",
      "両者に聞こえる声で正しく伝える": "両方に聞こえる声で言う",
      "進行を止めて確認する": "いったん止めて確認する",
      "勘で続ける": "なんとなく続ける",
      "カウント、サーバー、レシーバー": "カウント・サーバー・レシーバー",
      "第2サービスを行う": "2本目のサーブをする",
      "ただちに失ポイント": "すぐ相手の点",
      "ダブルフォールトで失ポイント": "ダブルフォールトで相手の点",
      "正しいレシーブ順と位置を確認する": "正しい順番と位置を確認する",
      "聞こえるように再度コールする": "聞こえる声でもう一度言う",
      "ライン付近のイン・アウト": "ラインの近くのイン・アウト",
      "準備が整ってから進める": "準備できてから始める",
      "気づいた時点で確認する": "気づいたらすぐ確認する",
      "プレーを止めてノーカウントにする": "止めて、やり直しにする",
      "サービスのやり直しか、ポイント全体のやり直しか": "サーブだけか、ポイント全部か",
      "ノーカウントの可能性": "ノーカウントか確認する",
      "公平性と安全性を保つこと": "公平さと安全を守ること",
      "そのポイントは数えず、状況を戻して再開する": "その点は数えず、戻して再開",
      "該当するサービスをやり直す": "そのサーブをやり直す",
      "イン側として扱う": "インにする",
      "主審へ判定を示して補助する": "主審に判定を知らせる",
      "プレーを止める意思を明確にする": "止めることをはっきり伝える",
      "次のサーバーが分かるように進める": "次にだれがサーブか分かるようにする",
      "落ち着いて訂正し、理由を簡潔に示す": "落ち着いて直し、短く説明する",
      "短い言葉をはっきり出す": "短く、はっきり言う",
      "サービス、レシーブ、サイドの選択": "サーブ・レシーブ・サイド",
      "サービス・レシーブ・サイドの選択": "サーブ・レシーブ・サイド",
      "大会要項・競技上の注意": "大会のきまりや注意",
      "両者に分かるよう公平に行う": "両方に見えるよう公平に行う",
      "選択内容を確認して試合開始につなげる": "選んだ内容を確認して始める"
    };
    return replacements[text] || text;
  }

  function widthClass(percent) {
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    return `w-${Math.round(safePercent / 5) * 5}`;
  }

  function escapeAttr(value) {
    return escapeHtml(value).replaceAll("`", "&#96;");
  }

  document.addEventListener("click", (event) => {
    const tabButton = event.target.closest("[data-tab]");
    if (tabButton) {
      state.tab = tabButton.dataset.tab;
      render();
      return;
    }

    const answerButton = event.target.closest("[data-answer]");
    if (answerButton) {
      answerQuestion(answerButton.dataset.answer);
      return;
    }

    const nextButton = event.target.closest("#nextQuestionButton");
    if (nextButton) {
      nextQuestion();
      render();
      return;
    }

    const startNextSetButton = event.target.closest("#startNextSetButton");
    if (startNextSetButton) {
      startDrillSet();
      render();
      return;
    }

    const goReviewButton = event.target.closest("#goReviewButton");
    if (goReviewButton) {
      state.tab = "review";
      render();
      return;
    }

    const categoryButton = event.target.closest("[data-category]");
    if (categoryButton) {
      const selectedCategory = categoryButton.dataset.category;
      startDrillSet(selectedCategory);
      state.tab = "quiz";
      render();
      return;
    }

    const reviewButton = event.target.closest("[data-review]");
    if (reviewButton) {
      const question = questions.find((item) => item.id === reviewButton.dataset.review);
      if (question) {
        state.drillSet = [question.id];
        state.drillIndex = 0;
        state.setCorrect = 0;
        state.setFinished = false;
        state.currentQuestion = normalizeQuestion(question);
        state.selectedAnswerId = "";
        state.tab = "quiz";
        render();
      }
      return;
    }

    const resetButton = event.target.closest("#resetProgressButton");
    if (resetButton && confirm("この端末の学習記録を消しますか？")) {
      state.progress = defaultProgress();
      startDrillSet();
      saveProgress();
      render();
    }
  });

  startDrillSet();
  render();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
