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
    currentAnswer: '',   // 当前输入
    sessionStartTime: 0, // 本组答题开始时间戳
    questionStartTime: 0,// 当前题目开始时间戳
    questionTimes: [],   // 每道题用时（秒）
    timerId: null,       // 计时器句柄
    nextQTimer: null,    // 下一题延迟计时器句柄（退出时需清除，避免结算页自动弹出）
    isPractice: false    // 是否为错题练习模式（不触发解锁与连续通关）
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

  // ==================== 计时器 ====================

  /**
   * 格式化秒数为 mm:ss
   * @param {number} seconds
   * @returns {string}
   */
  function formatTime(seconds) {
    if (!seconds || seconds < 0) seconds = 0;
    seconds = Math.floor(seconds);
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  /**
   * 启动本组计时器（每秒刷新顶栏显示）
   */
  function startTimer() {
    stopTimer();
    quizState.sessionStartTime = Date.now();
    quizState.questionStartTime = Date.now();
    updateTimerDisplay();
    quizState.timerId = setInterval(updateTimerDisplay, 1000);
  }

  /**
   * 停止计时器
   */
  function stopTimer() {
    if (quizState.timerId) {
      clearInterval(quizState.timerId);
      quizState.timerId = null;
    }
  }

  /**
   * 刷新顶栏计时器显示
   */
  function updateTimerDisplay() {
    if (!quizState.sessionStartTime) return;
    var elapsed = (Date.now() - quizState.sessionStartTime) / 1000;
    var txt = $('quiz-timer-text');
    var timer = $('quiz-timer');
    if (txt) txt.textContent = formatTime(elapsed);
    // 超过 120 秒进入提醒状态
    if (timer) {
      if (elapsed >= 120) timer.classList.add('warning');
      else timer.classList.remove('warning');
    }
  }

  /**
   * 记录当前题目用时（秒）
   */
  function recordQuestionTime() {
    if (!quizState.questionStartTime) return;
    var t = Math.round((Date.now() - quizState.questionStartTime) / 1000);
    quizState.questionTimes.push(t);
  }

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
   * 渲染首页：更新统计 + 今日进度 + 难度卡片
   */
  function renderHome() {
    updateHomeStats();
    renderTodayProgress();
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
    var streakEl = $('home-streak');
    var streakPill = $('home-streak-pill');
    if (pointsEl) {
      // 统一积分格式：整数显示原值，小数显示 1 位（与主题商店/结算页一致）
      var p = state.points;
      pointsEl.textContent = (p % 1 === 0) ? p : p.toFixed(1);
    }
    if (totalEl) totalEl.textContent = state.totalQuestions;
    // 徽章计数
    var badgeCount = state.badges ? state.badges.length : 0;
    if (badgeEl) badgeEl.textContent = badgeCount;
    // 连续学习天数
    var streak = state.studyStreak || 0;
    if (streakEl) streakEl.textContent = streak;
    if (streakPill) {
      // 今日已学习则高亮，否则灰显
      var todayStudied = state.lastStudyDate === global.Storage.getTodayStr();
      streakPill.classList.toggle('active', todayStudied && streak > 0);
    }
  }

  /**
   * 渲染今日学习进度卡片
   */
  function renderTodayProgress() {
    global.HomePage.renderTodayProgress();
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
      if (isUnlocked) {
        var clearCount = global.Difficulty.getClearCount(level.id) || 0;
        if (clearCount > 0) {
          streakInfo = ' · 通关' + clearCount + '次';
        }
        if (bestStreak > 0) {
          streakInfo += ' · 最高连击 ' + bestStreak;
        }
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
   * @param {Object} [opts] - { questions: 自定义题目数组, isPractice: 是否练习模式 }
   */
  function startQuiz(level, opts) {
    opts = opts || {};
    // 初始化音效（首次用户交互后）
    try { global.Sound.init(); } catch (e) { /* 忽略 */ }

    // 清理上一组残留的计时器/状态，避免返回后旧定时器仍触发结算
    stopTimer();
    if (quizState.nextQTimer) {
      clearTimeout(quizState.nextQTimer);
      quizState.nextQTimer = null;
    }

    // 每日首次答题奖励（练习模式不触发）—— 延迟到 renderQuestion 之后再展示，
    // 否则 renderQuestion 会立即清空 quiz-feedback，奖励文案根本看不到
    var pendingDailyReward = false;
    if (!opts.isPractice) {
      try {
        pendingDailyReward = !!global.Storage.claimDailyReward();
      } catch (e) { /* 忽略 */ }
    }

    // 重置答题状态
    quizState.level = level;
    // 优先使用自定义题目（错题重练），否则生成新题
    quizState.questions = (Array.isArray(opts.questions) && opts.questions.length > 0)
      ? opts.questions
      : global.QuestionGenerator.generate(level, 10);
    quizState.results = [];
    quizState.currentIndex = 0;
    quizState.currentStreak = 0;
    quizState.isAnswering = false;
    quizState.currentAnswer = '';
    quizState.questionTimes = [];
    quizState.isPractice = !!opts.isPractice;

    // 更新连续学习天数（每日首次答题）
    try {
      var newStreak = global.Storage.updateStudyStreak();
      if (newStreak > 0) {
        showStudyStreakToast(newStreak);
      }
    } catch (e) { /* 忽略 */ }

    // 初始化进度小圆点
    initProgressDots();

    navigateTo('quiz');
    // 启动本组计时器
    startTimer();
    renderQuestion();
    // 渲染完题目后再展示每日奖励，避免被 renderQuestion 清空
    if (pendingDailyReward) showDailyReward();
  }

  /**
   * 错题重练：从指定难度的错题本生成一组练习题
   * @param {number} level - 难度等级
   */
  function startErrorPractice(level) {
    var errors = global.ErrorBook.getByLevel(level) || [];
    if (errors.length === 0) return;

    // 将错题转换为可作答的题目对象
    var pool = errors.map(function (err) {
      var answerType = (err.type === 'compare') ? 'symbol' : 'number';
      return {
        display: err.display || '',
        answer: String(err.correctAnswer),
        answerType: answerType,
        type: err.type || 'basic'
      };
    });

    // 最多取 10 题，乱序
    pool.sort(function () { return Math.random() - 0.5; });
    if (pool.length > 10) pool = pool.slice(0, 10);

    startQuiz(level, { questions: pool, isPractice: true });
  }

  /**
   * 显示每日奖励提示
   */
  function showDailyReward() {
    var el = $('quiz-feedback');
    if (!el) return;
    el.className = 'quiz-feedback daily-reward';
    el.innerHTML = '🎁 每日首次答题奖励 +1⭐';
    setTimeout(function () {
      if (quizState.currentIndex === 0) {
        el.innerHTML = '';
        el.className = 'quiz-feedback';
      }
    }, 2500);
  }

  /**
   * 显示连续学习天数提示（每日首次答题时）
   * 复用 streak-milestone 横幅样式，透明不遮挡
   * @param {number} streak - 当前连续学习天数
   */
  function showStudyStreakToast(streak) {
    var el = $('streak-milestone');
    if (!el) return;
    var msg = streak === 1
      ? '📖 今天第一次学习，开启连胜！'
      : '📖 连续学习 ' + streak + ' 天，保持下去！';
    el.innerHTML = '<div class="milestone-text">' + msg + '</div>';
    el.classList.add('show');
    setTimeout(function () {
      el.classList.remove('show');
    }, 1800);
  }

  /**
   * 初始化10个进度小圆点
   */
  function initProgressDots() {
    var dotsEl = $('quiz-dots');
    if (!dotsEl) return;
    dotsEl.innerHTML = '';
    for (var i = 0; i < 10; i++) {
      var dot = document.createElement('span');
      dot.className = 'quiz-dot';
      dot.setAttribute('data-idx', i);
      dotsEl.appendChild(dot);
    }
  }

  /**
   * 更新进度小圆点状态
   * @param {number} currentIdx - 当前题号（0-9）
   * @param {Array} results - 已答结果数组
   */
  function updateProgressDots(currentIdx, results) {
    var dots = document.querySelectorAll('.quiz-dot');
    dots.forEach(function (dot, i) {
      dot.classList.remove('current', 'correct', 'wrong');
      if (i < currentIdx) {
        // 已答过的题
        var r = results[i];
        if (r) {
          dot.classList.add(r.correct ? 'correct' : 'wrong');
        }
      } else if (i === currentIdx) {
        dot.classList.add('current');
      }
    });
  }

  /**
   * 显示题型标签
   * @param {Object} q - 题目对象
   */
  function showTypeTag(q) {
    var tagEl = $('quiz-type-tag');
    if (!tagEl) return;
    var label = '';
    var icon = '';
    if (q.type === 'basic') { label = '加减法'; icon = '➕'; }
    else if (q.type === 'fillblank') { label = '填空题'; icon = '✏️'; }
    else if (q.type === 'compare') { label = '比大小'; icon = '⚖️'; }
    tagEl.innerHTML = icon + ' ' + label;
  }

  /**
   * 显示连击里程碑特效
   * @param {number} streak - 当前连击数
   */
  function showStreakMilestone(streak) {
    var milestones = {
      5: { text: '5连对！太棒了！', icon: '🔥' },
      8: { text: '8连对！火力全开！', icon: '⚡' },
      10: { text: '10连对！完美通关！', icon: '👑' }
    };
    if (!milestones[streak]) return;

    var el = $('streak-milestone');
    if (!el) return;
    var m = milestones[streak];
    el.innerHTML = '<div class="milestone-text">' + m.icon + ' ' + m.text + '</div>';
    el.classList.add('show');
    setTimeout(function () {
      el.classList.remove('show');
    }, 1800);
  }

  /**
   * 渲染当前题目
   */
  function renderQuestion() {
    var idx = quizState.currentIndex;
    var q = quizState.questions[idx];
    if (!q) return;

    // 重置本题起始时间（排除上一题反馈延迟）
    quizState.questionStartTime = Date.now();

    // 更新进度
    $('quiz-current').textContent = String(idx + 1);
    var progressPct = ((idx + 1) / 10) * 100;
    $('quiz-progress-fill').style.width = progressPct + '%';

    // 更新进度小圆点
    updateProgressDots(idx, quizState.results);

    // 显示题型标签
    showTypeTag(q);

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
    // 记录本题用时
    recordQuestionTime();

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
    var lastTime = quizState.questionTimes[quizState.questionTimes.length - 1] || 0;
    if (isCorrect) {
      playSound('correct');
      quizState.currentStreak++;
      showFeedback(true, lastTime);
      // 连击里程碑特效
      showStreakMilestone(quizState.currentStreak);
    } else {
      playSound('wrong');
      quizState.currentStreak = 0;
      showFeedback(false, lastTime);
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

    // 延迟后进入下一题（存句柄，退出答题时需清除避免结算页自动弹出）
    var delay = isCorrect ? 1000 : 2000;
    if (quizState.nextQTimer) clearTimeout(quizState.nextQTimer);
    quizState.nextQTimer = setTimeout(function () {
      quizState.nextQTimer = null;
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
  function showFeedback(isCorrect, usedTime) {
    var fb = $('quiz-feedback');
    var timeTag = (usedTime != null && usedTime >= 0)
      ? ' <span class="feedback-time">⏱️ ' + usedTime + '秒</span>'
      : '';
    if (isCorrect) {
      fb.className = 'quiz-feedback correct';
      var praises = [
        '答对了！', '真棒！', '太厉害了！', '继续加油！', '你真聪明！',
        '完美！', '好样的！', '了不起！', '继续保持！', '满分小能手！'
      ];
      fb.innerHTML = '🎉 ' + praises[Math.floor(Math.random() * praises.length)] + timeTag;
      // 答案框弹跳动画
      var box = $('answer-box');
      if (box) {
        box.classList.add('answer-bounce');
        setTimeout(function () { box.classList.remove('answer-bounce'); }, 500);
      }
    } else {
      fb.className = 'quiz-feedback wrong';
      var encourages = ['没关系，下次一定行！', '别灰心，再试一次！', '加油，你能做到的！', '错了也没关系，继续努力！'];
      fb.innerHTML = '💪 ' + encourages[Math.floor(Math.random() * encourages.length)] + timeTag;
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
    // 停止计时器，汇总用时
    stopTimer();
    var totalTime = 0;
    var questionTimes = quizState.questionTimes.slice();
    questionTimes.forEach(function (t) { totalTime += t; });

    var results = quizState.results;
    var scoring = global.Scoring.calculate(results);
    var level = quizState.level;
    var isClear = scoring.isFullClear;

    // 更新最佳连胜
    global.Storage.updateBestStreak(level, scoring.maxStreak);

    // 添加积分（练习模式也计积分以激励）
    if (scoring.totalPoints > 0) {
      global.Storage.addPoints(scoring.totalPoints);
    }

    // 判断是否新解锁下一关（练习模式不触发解锁与连续通关）
    var isNewUnlock = false;
    var isPractice = quizState.isPractice;
    if (isClear && !isPractice) {
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
    } else if (!isClear && !isPractice) {
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
      totalTime: totalTime,
      questionTimes: questionTimes,
      isPractice: isPractice,
      onRetry: function () {
        // 练习模式重试：重新生成错题练习；普通模式：重新生成新题
        if (isPractice) {
          startErrorPractice(level);
        } else {
          startQuiz(level);
        }
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
          stopTimer();
          // 清除"下一题"延迟定时器，避免返回后仍触发 finishQuiz 跳结算页
          if (quizState.nextQTimer) {
            clearTimeout(quizState.nextQTimer);
            quizState.nextQTimer = null;
          }
          quizState.isAnswering = false;
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

  // ==================== 对外暴露接口 ====================
  // 供错题本等子页面调用入口
  global.App = {
    startErrorPractice: startErrorPractice
  };

  // DOM 就绪后启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(typeof window !== 'undefined' ? window : this);
