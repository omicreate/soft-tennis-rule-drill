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
      .map((source) => `<a href="${escapeAttr(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.rank)}: ${escapeHtml(source.publisher)}</a>`)
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
          <span>${escapeHtml(question.category)}</span>
          <strong>${escapeHtml(progressText)}</strong>
        </div>
        <div class="progress-track"><span class="${widthClass(Math.min(100, (state.progress.totalAnswered % reviewedQuestions().length) / reviewedQuestions().length * 100))}"></span></div>
        ${renderCourtIllustration(question)}
        <div class="question-card">
          <p class="question-id">${escapeHtml(question.id)} / ${escapeHtml(question.sourceRank)}ランク</p>
          <h2>${escapeHtml(question.prompt)}</h2>
          <div class="choice-list">
            ${question.choices
              .map((choice, index) => {
                const correctClass = selected && choice.id === question.answerId ? "correct" : "";
                const wrongClass = selected === choice.id && choice.id !== question.answerId ? "wrong" : "";
                return `<button class="choice-button ${correctClass} ${wrongClass}" type="button" data-answer="${escapeAttr(choice.id)}" ${selected ? "disabled" : ""}>
                  <span class="choice-number">${index + 1}</span>
                  <span>${escapeHtml(choice.text)}</span>
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
            : `<p class="hint-line">選択肢をタップすると、公式用語と短い解説が出ます。</p>`
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
          <p>公式用語を先に見てから、4択で確認できます。</p>
        </div>
        <div class="rule-update-card">
          <strong>2026年コイントス運用を反映</strong>
          <p>JSTA公式トピックスと連盟資料を分けて管理。大会ごとの競技上の注意は必ず確認する前提です。</p>
        </div>
        <div class="category-grid">
          ${stats
            .map(
              (item) => `<button class="category-card" type="button" data-category="${escapeAttr(item.category)}">
                <span>${escapeHtml(item.category)}</span>
                <strong>${item.correct}/${item.total}</strong>
                <small>確認済み ${item.total}問</small>
              </button>`
            )
            .join("")}
        </div>
        <section class="source-panel">
          <h3>出典ランク</h3>
          ${sources
            .map(
              (source) => `<a href="${escapeAttr(source.url)}" target="_blank" rel="noreferrer" class="source-row">
                <span>${escapeHtml(source.rank)}</span>
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
                <span>${escapeHtml(item.category)}</span>
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
          <span>模擬試験</span>
          <strong>${state.exam.index + 1}/${state.exam.questions.length}</strong>
        </div>
        ${renderCourtIllustration(question)}
        <div class="question-card">
          <p class="question-id">${escapeHtml(question.category)}</p>
          <h2>${escapeHtml(question.prompt)}</h2>
          <div class="choice-list">
            ${question.choices
              .map((choice, index) => `<button class="choice-button" type="button" data-exam-answer="${escapeAttr(choice.id)}">
                <span class="choice-number">${index + 1}</span>
                <span>${escapeHtml(choice.text)}</span>
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
              <span>${escapeHtml(item.category)}</span>
              <div><span class="${widthClass(item.rate)}"></span></div>
              <strong>${item.rate}%</strong>
            </div>`)
            .join("")}
        </div>
        <section class="review-list">
          <h2>復習リスト</h2>
          ${
            reviewItems.length
              ? reviewItems.map((item) => `<button type="button" data-review="${escapeAttr(item.id)}">${escapeHtml(item.officialTerm)}: ${escapeHtml(item.prompt)}</button>`).join("")
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
