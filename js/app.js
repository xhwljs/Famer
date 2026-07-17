/**
 * app.js - 主应用逻辑模块
 * 儿童数学闯关游戏 - 页面路由、游戏流程、事件绑定
 *
 * 依赖全局：Storage, Sound, QuestionGenerator, Scoring, Difficulty,
 *           Badges, Themes, ErrorBook, Keyboard, Settlement
 *
 * 职责：
 *   1. 初始化游戏（加载主题、渲染首页）
 *   2. 页面路由（home / quiz / settlement / badges / themes / error-book / stats）
 *   3. 答题流程（生成题目 → 展示 → 判分 → 反馈 → 下一题 → 结算）
 *   4. 子页面渲染与事件绑定
 */

(function (global) {
  'use strict';

  // ==================== 答题会话状态 ====================
  var quizState = {
    level: null,         // 当前难度 20/50/100
    questions: [],       // 10 道题目
    results: [],         // 10 道答题结果
    currentIndex: 0,     // 当前题号（0-9）
    currentStreak: 0,    // 当前连对数
    isAnswering: false,  // 是否正在答题（防重复提交）
    currentAnswer: ''    // 当前输入
  };

  // ==================== 工具函数 ====================

  /**
   * 安全播放音效
   */
  function playSound(type) {
    try { global.Sound.play(type); } catch (e) { /* 忽略 */ }
  }

  /**
   * 将全角符号转为半角（键盘输入 ＞＜＝ 转为 ><= ）
   */
  function normalizeSymbol(input) {
    if (!input) return '';
    return String(input)
      .replace(/\uFF1E/g, '>')  // ＞
      .replace(/\uFF1C/g, '<')  // ＜
      .replace(/\uFF1D/g, '='); // ＝
  }

  /**
   * 获取 DOM 元素
   */
  function $(id) { return document.getElementById(id); }

  // ==================== 页面路由 ====================

  /**
   * 切换到指定页面
   * @param {string} pageId - 页面 ID（不含 #page- 前缀的名称部分）
   */
  function navigateTo(pageName) {
    var pages = document.querySelectorAll('.page');
    for (var i = 0; i < pages.length; i++) {
      pages[i].classList.remove('active');
    }
    var target = $('page-' + pageName);
    if (target) {
      target.classList.add('active');
      target.scrollTop = 0;
    }
  }

  // ==================== 首页 ====================

  /**
   * 渲染首页：更新统计 + 难度卡片
   */
  function renderHome() {
    updateHomeStats();
    renderDifficultyCards();
    // 更新吉祥物
    var themeDef = null;
    try {
      var currentTheme = global.Themes.getCurrent();
      for (var i = 0; i < global.Themes.DEFINITIONS.length; i++) {
        if (global.Themes.DEFINITIONS[i].id === currentTheme) {
          themeDef = global.Themes.DEFINITIONS[i];
          break;
        }
      }
    } catch (e) { /* 忽略 */ }
    if (themeDef) {
      var mascotEl = $('home-mascot');
      if (mascotEl) mascotEl.textContent = themeDef.mascot;
    }
  }

  /**
   * 更新首页顶部统计栏
   */
  function updateHomeStats() {
    var state = global.Storage.getState();
    var pointsEl = $('home-points');
    var badgeEl = $('home-badge-count');
    var totalEl = $('home-total-questions');
    if (pointsEl) pointsEl.textContent = Math.floor(state.points);
    if (totalEl) totalEl.textContent = state.totalQuestions;
    // 徽章计数
    var badgeCount = state.badges ? state.badges.length : 0;
    if (badgeEl) badgeEl.textContent = badgeCount;
  }

  /**
   * 渲染难度选择卡片
   */
  function renderDifficultyCards() {
    var container = $('difficulty-cards');
    if (!container) return;
    container.innerHTML = '';

    var status = global.Difficulty.getStatus();
    global.Difficulty.LEVELS.forEach(function (level) {
      var info = status[level.id] || {};
      var isUnlocked = !!info.unlocked;
      var isCompleted = !!info.completed;
      var bestStreak = info.bestStreak || 0;

      var card = document.createElement('div');
      card.className = 'difficulty-card';
      if (!isUnlocked) card.classList.add('locked');
      else if (isCompleted) card.classList.add('completed');
      else card.classList.add('unlocked');

      var statusBadge = '';
      if (!isUnlocked) {
        statusBadge = '<div class="dc-badge"></div>';
      } else if (isCompleted) {
        statusBadge = '<div class="dc-badge">✓</div>';
      } else {
        statusBadge = '<div class="dc-badge">▶</div>';
      }

      var streakInfo = '';
      if (isUnlocked && bestStreak > 0) {
        streakInfo = ' · 最高连击 ' + bestStreak;
      }

      card.innerHTML =
        '<div class="dc-icon">' +
          '<span>' + level.icon + '</span>' +
        '</div>' +
        '<div class="dc-info">' +
          '<div class="dc-name">' + level.name + '</div>' +
          '<div class="dc-status">' + level.description + streakInfo + '</div>' +
        '</div>' +
        statusBadge;

      if (isUnlocked) {
        card.addEventListener('click', function () {
          playSound('click');
          startQuiz(level.id);
        });
      } else {
        card.addEventListener('click', function () {
          playSound('wrong');
          // 轻微抖动提示锁定
          card.classList.add('animate-shake');
          setTimeout(function () { card.classList.remove('animate-shake'); }, 400);
        });
      }

      container.appendChild(card);
    });
  }

  // ==================== 答题流程 ====================

  /**
   * 开始一组答题
   * @param {number} level - 难度等级
   */
  function startQuiz(level) {
    // 初始化音效（首次用户交互后）
    try { global.Sound.init(); } catch (e) { /* 忽略 */ }

    // 重置答题状态
    quizState.level = level;
    quizState.questions = global.QuestionGenerator.generate(level, 10);
    quizState.results = [];
    quizState.currentIndex = 0;
    quizState.currentStreak = 0;
    quizState.isAnswering = false;
    quizState.currentAnswer = '';

    navigateTo('quiz');
    renderQuestion();
  }

  /**
   * 渲染当前题目
   */
  function renderQuestion() {
    var idx = quizState.currentIndex;
    var q = quizState.questions[idx];
    if (!q) return;

    // 更新进度
    $('quiz-current').textContent = String(idx + 1);
    var progressPct = ((idx + 1) / 10) * 100;
    $('quiz-progress-fill').style.width = progressPct + '%';

    // 更新连击显示
    var streakEl = $('quiz-streak-display');
    var streakCount = $('quiz-streak-count');
    if (quizState.currentStreak >= 3) {
      streakEl.style.visibility = 'visible';
      streakCount.textContent = String(quizState.currentStreak);
    } else {
      streakEl.style.visibility = 'hidden';
    }

    // 渲染题目（将 □ 替换为答案框）
    var area = $('quiz-question-area');
    area.innerHTML = '';

    var questionEl = document.createElement('div');
    questionEl.className = 'quiz-question animate-popIn';

    // 拆分 display 字符串，在 □ 处插入答案框
    var parts = q.display.split('\u25A1');
    var html = '';
    for (var i = 0; i < parts.length; i++) {
      html += '<span class="q-text">' + escapeHtml(parts[i]) + '</span>';
      if (i < parts.length - 1) {
        html += '<span class="answer-box" id="answer-box">?</span>';
      }
    }
    questionEl.innerHTML = html;
    area.appendChild(questionEl);

    // 清空反馈区
    $('quiz-feedback').innerHTML = '';
    $('quiz-feedback').className = 'quiz-feedback';

    // 渲染键盘
    var kbType = (q.answerType === 'symbol') ? 'symbol' : 'number';
    global.Keyboard.show($('keyboard-area'), {
      type: kbType,
      onKey: function (input) {
        updateAnswerBox(input);
      },
      onSubmit: function (input) {
        handleSubmit(input);
      }
    });

    quizState.isAnswering = false;
    quizState.currentAnswer = '';
  }

  /**
   * 更新答案框显示
   */
  function updateAnswerBox(input) {
    quizState.currentAnswer = input;
    var box = $('answer-box');
    if (!box) return;
    if (input && input.length > 0) {
      box.textContent = input;
      box.classList.add('filled');
    } else {
      box.textContent = '?';
      box.classList.remove('filled');
    }
  }

  /**
   * 提交答案
   */
  function handleSubmit(input) {
    if (quizState.isAnswering) return;
    if (!input || input.length === 0) return;

    quizState.isAnswering = true;
    // 禁用键盘防止重复提交
    global.Keyboard.disable();

    var q = quizState.questions[quizState.currentIndex];
    var userAnswer, correctAnswer;
    if (q.answerType === 'symbol') {
      userAnswer = normalizeSymbol(input);
      correctAnswer = String(q.answer);
    } else {
      // 数字题：去除前导零后比较
      var num = parseInt(input, 10);
      userAnswer = isNaN(num) ? input : String(num);
      correctAnswer = String(q.answer);
    }
    var isCorrect = (userAnswer === correctAnswer);

    // 记录结果
    quizState.results.push({
      correct: isCorrect,
      userAnswer: userAnswer,
      correctAnswer: correctAnswer
    });

    // 更新答案框颜色
    var box = $('answer-box');
    if (box) {
      box.textContent = userAnswer;
      if (isCorrect) {
        box.classList.add('correct');
        box.classList.remove('filled');
      } else {
        box.classList.add('wrong');
        box.classList.remove('filled');
        // 同时显示正确答案
        showCorrectAnswer(q, correctAnswer);
      }
    }

    // 播放音效 + 反馈
    if (isCorrect) {
      playSound('correct');
      quizState.currentStreak++;
      showFeedback(true);
    } else {
      playSound('wrong');
      quizState.currentStreak = 0;
      showFeedback(false);
    }

    // 记录到存储
    global.Storage.addQuestionAnswered(isCorrect);

    // 答错时记录错题
    if (!isCorrect) {
      global.ErrorBook.add(quizState.level, {
        display: q.display,
        userAnswer: userAnswer,
        correctAnswer: correctAnswer,
        type: q.type,
        timestamp: Date.now()
      });
    }

    // 延迟后进入下一题
    var delay = isCorrect ? 1000 : 2000;
    setTimeout(function () {
      nextQuestion();
    }, delay);
  }

  /**
   * 在答错时显示正确答案
   */
  function showCorrectAnswer(q, correctAnswer) {
    var area = $('quiz-question-area');
    var ansEl = document.createElement('div');
    ansEl.className = 'correct-answer-hint';
    ansEl.innerHTML = '正确答案：<span class="correct-text">' + escapeHtml(correctAnswer) + '</span>';
    area.appendChild(ansEl);
  }

  /**
   * 显示答题反馈
   */
  function showFeedback(isCorrect) {
    var fb = $('quiz-feedback');
    if (isCorrect) {
      fb.className = 'quiz-feedback correct';
      var praises = ['答对了！', '真棒！', '太厉害了！', '继续加油！', '你真聪明！'];
      fb.innerHTML = '🎉 ' + praises[Math.floor(Math.random() * praises.length)];
    } else {
      fb.className = 'quiz-feedback wrong';
      fb.innerHTML = '💪 没关系，下次一定行！';
    }
  }

  /**
   * 下一题或结束
   */
  function nextQuestion() {
    quizState.currentIndex++;
    if (quizState.currentIndex >= 10) {
      finishQuiz();
    } else {
      renderQuestion();
    }
  }

  /**
   * 完成一组答题 → 结算
   */
  function finishQuiz() {
    var results = quizState.results;
    var scoring = global.Scoring.calculate(results);
    var level = quizState.level;
    var isClear = scoring.isFullClear;

    // 更新最佳连胜
    global.Storage.updateBestStreak(level, scoring.maxStreak);

    // 添加积分
    if (scoring.totalPoints > 0) {
      global.Storage.addPoints(scoring.totalPoints);
    }

    // 判断是否新解锁下一关
    var isNewUnlock = false;
    if (isClear) {
      // 首次通关此难度
      var wasCompleted = global.Difficulty.isCompleted(level);
      if (!wasCompleted) {
        global.Difficulty.complete(level);
      }
      // 解锁下一关
      var nextLevel = global.Difficulty.getNextLevel(level);
      if (nextLevel && !global.Difficulty.isUnlocked(nextLevel)) {
        global.Difficulty.unlock(nextLevel);
        isNewUnlock = true;
        setTimeout(function () { playSound('unlock'); }, 500);
      }
      // 连续通关计数
      global.Storage.incrementConsecutiveClears();
    } else {
      global.Storage.resetConsecutiveClears();
    }

    // 记录会话
    global.Storage.addSessionResult({
      level: level,
      correct: scoring.correctCount,
      total: 10,
      points: scoring.totalPoints,
      streak: scoring.maxStreak,
      timestamp: Date.now()
    });

    // 检查徽章
    var state = global.Storage.getState();
    var newBadges = global.Badges.check({
      level: level,
      correctCount: scoring.correctCount,
      total: 10,
      isFullClear: isClear,
      pointsEarned: scoring.totalPoints,
      totalQuestions: state.totalQuestions,
      totalPoints: state.points,
      consecutiveClears: state.consecutiveClears
    });

    // 渲染结算页
    var settleData = {
      level: level,
      questions: quizState.questions,
      results: results,
      scoring: scoring,
      isClear: isClear,
      isNewUnlock: isNewUnlock,
      newBadges: newBadges || [],
      onRetry: function () {
        startQuiz(level);
      },
      onHome: function () {
        renderHome();
        navigateTo('home');
      },
      onViewErrors: function () {
        renderErrorBookPage(level);
        navigateTo('error-book');
      }
    };

    global.Settlement.show($('settlement-container'), settleData);
    navigateTo('settlement');
  }

  // ==================== 子页面渲染 ====================

  /**
   * 渲染徽章页
   */
  function renderBadgesPage() {
    global.Badges.render($('badges-grid'));
  }

  /**
   * 渲染主题页
   */
  function renderThemesPage() {
    global.Themes.render($('themes-grid'));
  }

  /**
   * 渲染错题本页
   * @param {number} activeLevel - 默认选中的难度
   */
  function renderErrorBookPage(activeLevel) {
    var level = activeLevel || 20;
    var tabsEl = $('error-book-tabs');
    var listEl = $('error-book-list');
    global.ErrorBook.renderTabs(tabsEl, level);
    global.ErrorBook.render(listEl, level);

    // 使用事件委托绑定 tab 切换（避免清空后重新渲染丢失事件）
    tabsEl.onclick = function (e) {
      var tab = e.target.closest('.tab-btn');
      if (!tab) return;
      var lv = parseInt(tab.getAttribute('data-level'), 10);
      playSound('click');
      // 更新 tab active 状态
      var allTabs = tabsEl.querySelectorAll('.tab-btn');
      allTabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      global.ErrorBook.render(listEl, lv);
    };
  }

  /**
   * 渲染数据档案页
   */
  function renderStatsPage() {
    global.StatsPage.render(function onResetHome() {
      renderHome();
      navigateTo('home');
    });
  }

  // ==================== 弹窗 ====================

  function showModal(html) {
    var overlay = $('overlay');
    var content = $('modal-content');
    if (content) content.innerHTML = html;
    if (overlay) overlay.classList.add('active');
  }

  function hideModal() {
    var overlay = $('overlay');
    if (overlay) overlay.classList.remove('active');
  }

  // ==================== HTML 转义 ====================

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ==================== 事件绑定 ====================

  function bindEvents() {
    // 音效开关
    var soundToggle = $('sound-toggle');
    if (soundToggle) {
      soundToggle.addEventListener('click', function () {
        var enabled = !global.Sound.isEnabled();
        global.Sound.setEnabled(enabled);
        $('sound-icon').textContent = enabled ? '🔊' : '🔇';
        if (enabled) playSound('click');
      });
    }

    // 首页底部导航
    var navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        playSound('click');
        var page = btn.getAttribute('data-page');
        if (page === 'badges') {
          renderBadgesPage();
          navigateTo('badges');
        } else if (page === 'themes') {
          renderThemesPage();
          navigateTo('themes');
        } else if (page === 'error-book') {
          renderErrorBookPage(20);
          navigateTo('error-book');
        } else if (page === 'stats') {
          renderStatsPage();
          navigateTo('stats');
        }
      });
    });

    // 返回按钮
    var backBtns = document.querySelectorAll('.back-btn');
    backBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        playSound('click');
        renderHome();
        navigateTo('home');
      });
    });

    // 答题页返回
    var quizBack = $('quiz-back-btn');
    if (quizBack) {
      quizBack.addEventListener('click', function () {
        playSound('click');
        // 确认退出
        if (global.confirm('确定要退出本次答题吗？')) {
          renderHome();
          navigateTo('home');
        }
      });
    }

    // 点击遮罩关闭弹窗
    var overlay = $('overlay');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) hideModal();
      });
    }

    // 首次用户交互时初始化音频
    var soundInitDone = false;
    function initSoundOnce() {
      if (soundInitDone) return;
      soundInitDone = true;
      try { global.Sound.init(); } catch (e) { /* 忽略 */ }
    }
    document.addEventListener('touchstart', initSoundOnce, { once: true, passive: true });
    document.addEventListener('mousedown', initSoundOnce, { once: true });

    // 阻止双击缩放（移动端）
    var lastTouch = 0;
    document.addEventListener('touchend', function (e) {
      var now = Date.now();
      if (now - lastTouch < 350) {
        e.preventDefault();
      }
      lastTouch = now;
    }, { passive: false });
  }

  // ==================== 初始化 ====================

  function init() {
    // 确保存储初始化
    global.Storage.getState();

    // 读取音效开关状态
    try {
      var saved = localStorage.getItem('mathWorld_soundEnabled');
      var soundOn = (saved !== 'false');
      global.Sound.setEnabled(soundOn);
      var soundIcon = $('sound-icon');
      if (soundIcon) soundIcon.textContent = soundOn ? '🔊' : '🔇';
    } catch (e) { /* 忽略 */ }

    // 应用保存的主题
    try {
      var currentTheme = global.Themes.getCurrent();
      global.Themes.apply(currentTheme);
    } catch (e) { /* 忽略 */ }

    // 渲染首页
    renderHome();

    // 绑定事件
    bindEvents();
  }

  // DOM 就绪后启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(typeof window !== 'undefined' ? window : this);
