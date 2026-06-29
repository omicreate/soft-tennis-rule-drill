(() => {
  const STORAGE_KEY = "soft-tennis-rule-drill-progress-v1";
  const EXAM_SIZE = 25;
  const PASS_LINE = 70;

  const questions = globalThis.SOFT_TENNIS_REFEREE_QUESTIONS || [];
  const sources = globalThis.SOFT_TENNIS_REFEREE_SOURCES || [];
  const categories = globalThis.SOFT_TENNIS_REFEREE_QUESTION_CATEGORIES || [];
  const sourceMap = Object.fromEntries(sources.map((source) => [source.id, source]));

  const state = {
    tab: "quiz",
    quizQueue: [],
    currentQuestion: null,
    selectedAnswerId: "",
    exam: null,
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
      examResults: [],
      lastStudyAt: "",
      reviewQueue: []
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

  function nextQuestion() {
    if (state.quizQueue.length === 0) {
      const reviewIds = new Set(state.progress.reviewQueue.slice(0, 20));
      const priority = reviewedQuestions().filter((question) => reviewIds.has(question.id));
      const fresh = reviewedQuestions().filter((question) => !reviewIds.has(question.id));
      state.quizQueue = [...shuffle(priority), ...shuffle(fresh)];
    }
    state.currentQuestion = normalizeQuestion(state.quizQueue.shift());
    state.selectedAnswerId = "";
  }

  function answerQuestion(answerId) {
    if (!state.currentQuestion || state.selectedAnswerId) return;
    const question = state.currentQuestion;
    const correct = answerId === question.answerId;
    state.selectedAnswerId = answerId;
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
    saveProgress();
    render();
  }

  function startExam() {
    state.exam = {
      status: "active",
      questions: shuffle(reviewedQuestions()).slice(0, EXAM_SIZE).map(normalizeQuestion),
      index: 0,
      answers: {},
      startedAt: new Date().toISOString(),
      finishedAt: ""
    };
    state.tab = "exam";
    setActiveTab();
    render();
  }

  function answerExam(answerId) {
    if (!state.exam || state.exam.status !== "active") return;
    const question = state.exam.questions[state.exam.index];
    state.exam.answers[question.id] = answerId;
    if (state.exam.index < state.exam.questions.length - 1) {
      state.exam.index += 1;
    } else {
      finishExam();
    }
    render();
  }

  function finishExam() {
    const correct = state.exam.questions.filter((question) => state.exam.answers[question.id] === question.answerId);
    const result = {
      startedAt: state.exam.startedAt,
      finishedAt: new Date().toISOString(),
      questionIds: state.exam.questions.map((question) => question.id),
      score: Math.round((correct.length / state.exam.questions.length) * 100),
      categoryBreakdown: categoryStats(state.exam.questions, state.exam.answers)
    };
    state.exam.finishedAt = result.finishedAt;
    state.exam.status = "finished";
    state.progress.examResults = [result, ...state.progress.examResults].slice(0, 20);
    saveProgress();
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

  function perfectCount() {
    return state.progress.examResults.filter((result) => result.score === 100).length;
  }

  function updateStatus() {
    const correct = state.progress.totalCorrect;
    const wrong = Math.max(0, state.progress.totalAnswered - correct);
    document.querySelector("#correctValue").textContent = correct;
    document.querySelector("#wrongValue").textContent = wrong;
    document.querySelector("#perfectValue").textContent = perfectCount();
  }

  function setActiveTab() {
    navButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === state.tab);
    });
  }

  function sourceLinks(question) {
    return question.sourceRefs
      .map((id) => sourceMap[id])
      .filter(Boolean)
      .map((source) => `<a href="${escapeAttr(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.publisher)}</a>`)
      .join("");
  }

  function renderCourtIllustration(question) {
    const coinMode = question?.category === "2026年コイントス運用";
    return `
      <div class="court-visual ${coinMode ? "coin-mode" : ""}" aria-hidden="true">
        <div class="court-sky"></div>
        <div class="court-lines">
          <span class="net-line"></span>
          <span class="service-line"></span>
          <span class="center-line"></span>
          <span class="side-line left"></span>
          <span class="side-line right"></span>
        </div>
        <span class="plain-ball visual-ball"></span>
        <span class="ball-trail"></span>
        ${coinMode ? '<span class="coin-disc">表</span><span class="coin-disc second">裏</span>' : ""}
      </div>
    `;
  }

  function renderQuiz() {
    if (!state.currentQuestion) nextQuestion();
    const question = state.currentQuestion;
    const selected = state.selectedAnswerId;
    const isCorrect = selected && selected === question.answerId;
    const progressText = `${reviewedQuestions().length - state.quizQueue.length}/${reviewedQuestions().length}`;
    viewRoot.innerHTML = `
      <section class="quiz-panel">
        <div class="quiz-meta">
          <span>問題</span>
          <strong>${escapeHtml(progressText)}</strong>
        </div>
        <div class="progress-track"><span class="${widthClass(Math.min(100, (state.progress.totalAnswered % reviewedQuestions().length) / reviewedQuestions().length * 100))}"></span></div>
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
                <div class="source-list">${sourceLinks(question)}</div>
                <button class="primary-action" id="nextQuestionButton" type="button">次の問題へ</button>
              </section>`
            : `<p class="hint-line">選ぶと、正しいことばと短い説明が出ます。</p>`
        }
      </section>
    `;
  }

  function renderLearn() {
    const stats = categoryStats();
    viewRoot.innerHTML = `
      <section class="learn-panel">
        <div class="section-heading">
          <h2>学ぶ</h2>
          <p>むずかしい言葉はあとで確認。まずは場面で覚えよう。</p>
        </div>
        <div class="rule-update-card">
          <strong>基本ルールの練習用</strong>
          <p>できるだけ正しく作っていますが、大会やその日の決まりで変わることがあります。当日の審判委員・大会要項の指示を優先してください。</p>
        </div>
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
        <section class="source-panel">
          <h3>参考にした資料</h3>
          ${sources
            .map(
              (source) => `<a href="${escapeAttr(source.url)}" target="_blank" rel="noreferrer" class="source-row">
                <span>資料</span>
                <div>
                  <strong>${escapeHtml(source.title)}</strong>
                  <small>${escapeHtml(source.publisher)} / 確認日 ${escapeHtml(source.checkedAt)}</small>
                </div>
              </a>`
            )
            .join("")}
        </section>
      </section>
    `;
  }

  function renderExam() {
    if (!state.exam) {
      viewRoot.innerHTML = `
        <section class="exam-panel">
          <div class="section-heading">
            <h2>試験モード</h2>
            <p>${EXAM_SIZE}問をシャッフル。合格目安は${PASS_LINE}%ですが、公式試験の合否基準ではありません。</p>
          </div>
          <button class="primary-action wide" id="startExamButton" type="button">模擬試験を始める</button>
          <div class="mini-note">苦手問題は記録タブとクイズの復習に回ります。</div>
        </section>
      `;
      return;
    }

    if (state.exam.status === "finished") {
      const latest = state.progress.examResults[0];
      viewRoot.innerHTML = `
        <section class="exam-panel">
          <div class="result-ring ${latest.score >= PASS_LINE ? "pass" : ""}">
            <span>${latest.score}%</span>
            <small>${latest.score >= PASS_LINE ? "目安クリア" : "復習しよう"}</small>
          </div>
          <div class="category-bars">
            ${latest.categoryBreakdown
              .filter((item) => item.total > 0)
              .map((item) => `<div class="bar-row">
                <span>${escapeHtml(displayCategoryName(item.category))}</span>
                <div><span class="${widthClass(item.rate)}"></span></div>
                <strong>${item.rate}%</strong>
              </div>`)
              .join("")}
          </div>
          <button class="primary-action wide" id="startExamButton" type="button">もう一度シャッフル</button>
        </section>
      `;
      return;
    }

    const question = state.exam.questions[state.exam.index];
    viewRoot.innerHTML = `
      <section class="quiz-panel exam-active">
        <div class="quiz-meta">
          <span>試験</span>
          <strong>${state.exam.index + 1}/${state.exam.questions.length}</strong>
        </div>
        ${renderCourtIllustration(question)}
        <div class="question-card">
          <p class="question-id">ことば: ${escapeHtml(displayTerm(question))}</p>
          <h2>${escapeHtml(displayPrompt(question))}</h2>
          <p class="question-helper">試験と同じつもりで、あわてず選ぼう。</p>
          <div class="choice-list">
            ${question.choices
              .map((choice, index) => `<button class="choice-button" type="button" data-exam-answer="${escapeAttr(choice.id)}">
                <span class="choice-number">${index + 1}</span>
                <span>${escapeHtml(displayChoiceText(choice.text))}</span>
              </button>`)
              .join("")}
          </div>
        </div>
      </section>
    `;
  }

  function renderRecord() {
    const total = state.progress.totalAnswered || 0;
    const accuracy = total ? Math.round((state.progress.totalCorrect / total) * 100) : 0;
    const stats = categoryStats();
    const reviewItems = state.progress.reviewQueue
      .map((id) => questions.find((question) => question.id === id))
      .filter(Boolean)
      .slice(0, 8);
    viewRoot.innerHTML = `
      <section class="record-panel">
        <div class="record-summary">
          <div><span>回答数</span><strong>${total}</strong></div>
          <div><span>正答率</span><strong>${accuracy}%</strong></div>
          <div><span>習熟度</span><strong>${masteryRate()}%</strong></div>
        </div>
        <div class="category-bars">
          ${stats
            .map((item) => `<div class="bar-row">
              <span>${escapeHtml(displayCategoryName(item.category))}</span>
              <div><span class="${widthClass(item.rate)}"></span></div>
              <strong>${item.rate}%</strong>
            </div>`)
            .join("")}
        </div>
        <section class="review-list">
          <h2>復習リスト</h2>
          ${
            reviewItems.length
              ? reviewItems.map((item) => `<button type="button" data-review="${escapeAttr(item.id)}">${escapeHtml(item.officialTerm)}: ${escapeHtml(displayPrompt(item))}</button>`).join("")
              : "<p>まだ復習問題はありません。間違えた問題がここに入ります。</p>"
          }
        </section>
        <button class="ghost-action wide" id="resetProgressButton" type="button">学習記録をリセット</button>
      </section>
    `;
  }

  function render() {
    updateStatus();
    setActiveTab();
    if (state.tab === "learn") renderLearn();
    if (state.tab === "quiz") renderQuiz();
    if (state.tab === "exam") renderExam();
    if (state.tab === "record") renderRecord();
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

  function stripScenarioPrefix(text) {
    return String(text || "").replace(/^(試験前の確認|実際の試合で|もう一度確認|初心者へ説明するなら|模擬試験):\s*/, "");
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

    const categoryButton = event.target.closest("[data-category]");
    if (categoryButton) {
      const selectedCategory = categoryButton.dataset.category;
      state.quizQueue = shuffle(reviewedQuestions().filter((question) => question.category === selectedCategory));
      nextQuestion();
      state.tab = "quiz";
      render();
      return;
    }

    const startExamButton = event.target.closest("#startExamButton");
    if (startExamButton) {
      startExam();
      return;
    }

    const examAnswerButton = event.target.closest("[data-exam-answer]");
    if (examAnswerButton) {
      answerExam(examAnswerButton.dataset.examAnswer);
      return;
    }

    const reviewButton = event.target.closest("[data-review]");
    if (reviewButton) {
      const question = questions.find((item) => item.id === reviewButton.dataset.review);
      if (question) {
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
      saveProgress();
      render();
    }
  });

  nextQuestion();
  render();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
