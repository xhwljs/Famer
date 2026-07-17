/**
 * settlement.js - 结算页模块
 * 儿童数学闯关游戏 - 完成一组题目（10题）后的总结与回顾
 *
 * 通过全局对象 Settlement 暴露接口（window.Settlement）
 *
 * 页面结构：
 *   1. 顶部结果横幅（全对：「太棒了！」/ 否则：「继续加油！」）
 *   2. 统计卡片：答对数 / 正确率 / 积分 / 最高连击 / 通关状态
 *   3. 新难度解锁通知（若有）
 *   4. 新徽章解锁展示（若有）
 *   5. 10 题答题回顾列表（绿色正确 / 红色错误）
 *   6. 底部操作按钮：重新刷题 / 查看错题 / 返回主页
 *
 * 依赖全局：Sound
 */

(function (global) {
  'use strict';

  // 五彩纸屑颜色池
  var CONFETTI_COLORS = ['#FFB347', '#FF6B9D', '#4A90D9', '#81C784', '#FFD54F', '#A78BD9'];
  // 内联样式是否已注入
  var stylesInjected = false;

  /**
   * 安全播放音效
   * @param {string} type
   */
  function safePlay(type) {
    try {
      if (global.Sound && typeof global.Sound.play === 'function') {
        global.Sound.play(type);
      }
    } catch (e) { /* 忽略 */ }
  }

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
   * 题型文本映射
   * @param {string} type
   * @returns {string}
   */
  function typeLabel(type) {
    if (type === 'basic') return '➕ 加减法';
    if (type === 'fillblank') return '✏️ 填空题';
    if (type === 'compare') return '⚖️ 比大小';
    return '题目';
  }

  /**
   * 注入结算页所需的最小内联样式（保证在 CSS 未完成时也可用）
   */
  function injectStyles() {
    if (stylesInjected) return;
    if (document.getElementById('settlement-inline-styles')) {
      stylesInjected = true;
      return;
    }
    var style = document.createElement('style');
    style.id = 'settlement-inline-styles';
    style.textContent =
      '.settle-content{display:flex;flex-direction:column;gap:18px;padding:8px 4px 40px;}' +
      // 横幅
      '.settle-banner{text-align:center;padding:24px 16px;border-radius:28px;' +
        'background:var(--color-card,#FFF);box-shadow:var(--shadow-clay,0 8px 18px rgba(58,58,92,0.12));}' +
      '.settle-banner.success{background:linear-gradient(135deg,#FFF9EC,#FFE9D6);}' +
      '.settle-banner-emoji{font-size:3rem;line-height:1;}' +
      '.settle-banner-title{font-size:var(--fs-xxl,2rem);margin-top:6px;color:var(--color-text,#3A3A5C);}' +
      '.settle-banner-sub{font-size:var(--fs-sm,0.9rem);color:var(--color-text-muted,#8A8AA8);margin-top:4px;}' +
      // 统计卡片
      '.settle-stats-card{padding:18px;border-radius:24px;background:var(--color-card,#FFF);' +
        'box-shadow:var(--shadow-clay,0 8px 18px rgba(58,58,92,0.12));}' +
      '.settle-main-stat{display:flex;align-items:center;justify-content:space-between;gap:16px;}' +
      '.settle-correct-num{font-size:3rem;font-weight:800;color:var(--color-primary,#4A90D9);font-family:var(--font-heading);}' +
      '.settle-correct-num .settle-total{font-size:1.4rem;color:var(--color-text-muted,#8A8AA8);}' +
      '.settle-accuracy-ring{width:80px;height:80px;border-radius:50%;' +
        'background:conic-gradient(var(--color-success,#6BCB77) calc(var(--acc,0) * 1%),#E6E6F0 0);' +
        'display:flex;align-items:center;justify-content:center;position:relative;}' +
      '.settle-accuracy-ring::before{content:"";position:absolute;inset:8px;border-radius:50%;background:#FFF;}' +
      '.settle-accuracy-ring span{position:relative;font-weight:700;color:var(--color-text,#3A3A5C);}' +
      '.settle-stats-row{display:flex;justify-content:space-around;margin-top:18px;padding-top:16px;' +
        'border-top:2px dashed var(--color-border,#D9E6F2);}' +
      '.settle-stat{display:flex;flex-direction:column;align-items:center;gap:2px;}' +
      '.settle-stat-icon{font-size:1.4rem;}' +
      '.settle-stat-val{font-size:1.3rem;font-weight:700;color:var(--color-text,#3A3A5C);}' +
      '.settle-stat-label{font-size:0.75rem;color:var(--color-text-muted,#8A8AA8);}' +
      // 解锁通知
      '.settle-unlock-notif{display:flex;align-items:center;gap:14px;padding:16px;border-radius:20px;' +
        'background:linear-gradient(135deg,#FFF9EC,#FFEBCC);border:2px solid #FFD56B;' +
        'animation:settlePop 400ms ease-out;}' +
      '.settle-unlock-icon{font-size:2rem;}' +
      '.settle-unlock-title{font-weight:700;color:var(--color-text,#3A3A5C);}' +
      '.settle-unlock-desc{font-size:0.85rem;color:var(--color-text-muted,#8A8AA8);}' +
      // 新徽章
      '.settle-section-title{font-size:var(--fs-lg,1.2rem);font-weight:700;margin-bottom:8px;color:var(--color-text,#3A3A5C);}' +
      '.settle-new-badges{padding:16px;border-radius:20px;background:var(--color-card,#FFF);' +
        'box-shadow:var(--shadow-clay,0 8px 18px rgba(58,58,92,0.12));}' +
      '.settle-new-badge{display:flex;align-items:center;gap:12px;padding:10px;margin-top:8px;' +
        'border-radius:16px;background:#FFF9EC;animation:settlePop 400ms ease-out;}' +
      '.settle-badge-icon{font-size:2rem;}' +
      '.settle-badge-name{font-weight:700;color:var(--color-text,#3A3A5C);}' +
      '.settle-badge-desc{font-size:0.8rem;color:var(--color-text-muted,#8A8AA8);}' +
      // 回顾列表
      '.settle-review-list{display:flex;flex-direction:column;gap:10px;}' +
      '.settle-review-item{padding:12px 14px;border-radius:16px;display:flex;flex-direction:column;gap:6px;}' +
      '.settle-review-item.correct{background:#E8F6EC;border-left:5px solid var(--color-success,#6BCB77);}' +
      '.settle-review-item.wrong{background:#FDEAEA;border-left:5px solid var(--color-danger,#FF6B6B);}' +
      '.settle-review-q{display:flex;align-items:center;gap:8px;font-size:1.1rem;font-weight:600;color:var(--color-text,#3A3A5C);}' +
      '.settle-review-num{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;' +
        'border-radius:50%;background:rgba(0,0,0,0.06);font-size:0.85rem;}' +
      '.settle-review-answers{display:flex;flex-wrap:wrap;gap:8px;}' +
      '.settle-review-ans{padding:3px 10px;border-radius:12px;font-weight:600;font-size:0.95rem;}' +
      '.settle-review-ans.ok{background:#C8EBCF;color:#2E7D32;}' +
      '.settle-review-ans.bad{background:#F8C8C8;color:#C62828;}' +
      // 按钮
      '.settle-actions{display:flex;flex-direction:column;gap:10px;margin-top:8px;}' +
      '.settle-btn{padding:14px;border-radius:18px;font-size:1.05rem;font-weight:700;' +
        'border:3px solid transparent;transition:transform 100ms;}' +
      '.settle-btn:active{transform:scale(0.97);}' +
      '.settle-btn.primary{background:var(--color-primary,#4A90D9);color:#FFF;border-color:var(--color-primary-dark,#3A78B8);}' +
      '.settle-btn.secondary{background:var(--color-card,#FFF);color:var(--color-text,#3A3A5C);' +
        'border-color:var(--color-border,#D9E6F2);}' +
      // 五彩纸屑
      '.confetti-piece{position:fixed;top:-12px;width:10px;height:14px;border-radius:2px;' +
        'opacity:0.9;pointer-events:none;z-index:9999;' +
        'animation:confettiFall 2.8s ease-in forwards;}' +
      '@keyframes confettiFall{0%{transform:translateY(0) rotate(0);opacity:1;}' +
        '100%{transform:translateY(105vh) rotate(720deg);opacity:0.4;}}' +
      '@keyframes settlePop{0%{transform:scale(0.6);opacity:0;}' +
        '60%{transform:scale(1.08);opacity:1;}100%{transform:scale(1);}}' +
      // 用时统计标签
      '.settle-time-row{display:flex;gap:8px;margin-top:14px;}' +
      '.settle-time-pill{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;' +
        'padding:8px 6px;border-radius:14px;background:#F4F8FF;border:2px solid #D9E6F2;}' +
      '.settle-time-val{font-size:1.1rem;font-weight:700;color:var(--color-primary,#4A90D9);' +
        'font-family:var(--font-heading);font-variant-numeric:tabular-nums;}' +
      '.settle-time-label{font-size:0.72rem;color:var(--color-text-muted,#8A8AA8);}' +
      // 回顾筛选标签
      '.settle-filter-bar{display:flex;gap:8px;margin:6px 0 12px;}' +
      '.settle-filter-btn{flex:1;padding:8px 6px;border-radius:14px;border:2px solid var(--color-border,#D9E6F2);' +
        'background:var(--color-card,#FFF);font-weight:700;font-size:0.85rem;color:var(--color-text-muted,#8A8AA8);' +
        'transition:all 150ms ease-out;display:flex;align-items:center;justify-content:center;gap:4px;}' +
      '.settle-filter-btn:active{transform:scale(0.96);}' +
      '.settle-filter-btn.active{background:var(--color-primary,#4A90D9);color:#FFF;border-color:var(--color-primary-dark,#3A78B8);}' +
      '.settle-filter-btn .filter-count{font-size:0.72rem;opacity:0.85;}' +
      // 可展开的回顾项
      '.settle-review-item{cursor:pointer;position:relative;}' +
      '.settle-review-text{flex:1;min-width:0;word-break:break-word;}' +
      '.settle-review-item .settle-review-toggle{margin-left:auto;font-size:0.9rem;color:var(--color-text-muted,#8A8AA8);' +
        'transition:transform 200ms ease-out;flex-shrink:0;}' +
      '.settle-review-item.expanded .settle-review-toggle{transform:rotate(180deg);}' +
      '.settle-review-detail{max-height:0;overflow:hidden;transition:max-height 250ms ease-out,padding 200ms ease-out;' +
        'padding:0 4px;font-size:0.82rem;color:var(--color-text-muted,#8A8AA8);}' +
      '.settle-review-item.expanded .settle-review-detail{max-height:80px;padding-top:6px;}' +
      '.settle-review-detail span{margin-right:12px;}' +
      '.settle-review-item.hidden{display:none;}' +
      // 空态
      '.settle-review-empty{text-align:center;padding:24px 12px;color:var(--color-text-muted,#8A8AA8);' +
        'font-size:0.9rem;background:var(--color-card,#FFF);border-radius:16px;}';
    document.head.appendChild(style);
    stylesInjected = true;
  }

  /**
   * 触发庆祝动画：撒五彩纸屑 + 胜利音效
   * @param {string} type - 'confetti' | 'unlock' | 'badge'
   */
  function celebrate(type) {
    if (type === 'unlock' || type === 'badge') {
      safePlay('victory');
      return;
    }
    if (type === 'confetti') {
      safePlay('victory');
      try {
        var layer = document.getElementById('celebration-layer');
        var host = layer || document.body;
        for (var i = 0; i < 32; i++) {
          var piece = document.createElement('div');
          piece.className = 'confetti-piece';
          piece.style.left = Math.random() * 100 + '%';
          piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
          piece.style.animationDelay = (Math.random() * 0.5) + 's';
          piece.style.animationDuration = (2.2 + Math.random() * 1.2) + 's';
          host.appendChild(piece);
          (function (p) {
            setTimeout(function () {
              if (p && p.parentNode) p.parentNode.removeChild(p);
            }, 3500);
          })(piece);
        }
      } catch (e) { /* 忽略动画失败 */ }
    }
  }

  /**
   * 构建顶部结果横幅
   * @param {Object} data
   * @returns {HTMLElement}
   */
  function buildBanner(data) {
    var isClear = data.isClear;
    var isPractice = data.isPractice;
    var banner = document.createElement('div');
    banner.className = 'settle-banner ' + (isClear ? 'success' : 'normal');
    var subPrefix = (data.level || '') + '以内 · ';
    if (isPractice) subPrefix = '🔁 错题练习 · ' + subPrefix;
    banner.innerHTML =
      '<div class="settle-banner-emoji">' + (isClear ? '🎉' : '💪') + '</div>' +
      '<h2 class="settle-banner-title">' + (isClear ? '太棒了！' : '继续加油！') + '</h2>' +
      '<p class="settle-banner-sub">' + subPrefix +
        (isClear ? '全部通关！' : '再接再厉') + '</p>';
    return banner;
  }

  /**
   * 构建统计卡片
   * @param {Object} data
   * @returns {HTMLElement}
   */
  function buildStatsCard(data) {
    var scoring = data.scoring || {};
    var results = data.results || [];
    var total = results.length || 10;
    var correctCount = scoring.correctCount || 0;
    var accuracy = total > 0 ? Math.round(correctCount / total * 100) : 0;
    var points = scoring.totalPoints || 0;
    // 积分格式化：整数直接显示，小数保留1位
    var pointsDisplay = (points % 1 === 0) ? points : points.toFixed(1);
    var maxStreak = scoring.maxStreak || 0;
    var isClear = data.isClear;

    // 用时统计
    var totalTime = data.totalTime || 0;
    var avgTime = total > 0 ? Math.round(totalTime / total) : 0;

    var card = document.createElement('div');
    card.className = 'settle-stats-card';
    // 正确数与准确率使用动画占位（实际数字由 animateCountUp 填充）
    card.innerHTML =
      '<div class="settle-main-stat">' +
        '<div class="settle-correct-num" id="settle-correct-num" data-target="' + correctCount + '">0' +
          '<span class="settle-total">/' + total + '</span>' +
        '</div>' +
        '<div class="settle-accuracy-ring" id="settle-accuracy-ring" style="--acc:0">' +
          '<span id="settle-accuracy-text">0%</span>' +
        '</div>' +
      '</div>' +
      '<div class="settle-stats-row">' +
        '<div class="settle-stat">' +
          '<span class="settle-stat-icon">⭐</span>' +
          '<span class="settle-stat-val" id="settle-points" data-target="' + pointsDisplay + '">0</span>' +
          '<span class="settle-stat-label">积分</span>' +
        '</div>' +
        '<div class="settle-stat">' +
          '<span class="settle-stat-icon">🔥</span>' +
          '<span class="settle-stat-val" id="settle-streak" data-target="' + maxStreak + '">0</span>' +
          '<span class="settle-stat-label">最高连击</span>' +
        '</div>' +
        '<div class="settle-stat">' +
          '<span class="settle-stat-icon">' + (isClear ? '🏆' : '📝') + '</span>' +
          '<span class="settle-stat-val">' + (isClear ? '通关' : '未过') + '</span>' +
          '<span class="settle-stat-label">状态</span>' +
        '</div>' +
      '</div>' +
      '<div class="settle-time-row">' +
        '<div class="settle-time-pill">' +
          '<span class="settle-time-val">⏱️ ' + formatTime(totalTime) + '</span>' +
          '<span class="settle-time-label">总用时</span>' +
        '</div>' +
        '<div class="settle-time-pill">' +
          '<span class="settle-time-val">📊 ' + avgTime + '秒</span>' +
          '<span class="settle-time-label">平均每题</span>' +
        '</div>' +
      '</div>';
    return card;
  }

  /**
   * 数字滚动动画：从 0 平滑增长到目标值
   * @param {HTMLElement} el - 目标元素（含 data-target）
   * @param {number} duration - 动画时长（ms）
   */
  function animateCountUp(el, duration) {
    if (!el) return;
    var targetStr = el.getAttribute('data-target');
    if (targetStr == null) return;
    var target = parseFloat(targetStr);
    if (isNaN(target) || target <= 0) {
      el.firstChild ? (el.firstChild.nodeValue = targetStr) : (el.textContent = targetStr);
      return;
    }
    var isFloat = (targetStr.indexOf('.') >= 0);
    var start = 0;
    var startTime = 0;
    duration = duration || 800;

    function step(ts) {
      if (!startTime) startTime = ts;
      var progress = Math.min((ts - startTime) / duration, 1);
      // easeOutCubic 缓动
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = start + (target - start) * eased;
      var displayVal = isFloat ? current.toFixed(1) : Math.round(current);
      // 正确数元素包含 <span class="settle-total"> 子节点，需更新首个文本节点
      if (el.firstChild && el.firstChild.nodeType === 3) {
        el.firstChild.nodeValue = displayVal;
      } else {
        el.textContent = displayVal;
      }
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /**
   * 准确率环动画：conic-gradient 从 0 增长到目标百分比
   * @param {HTMLElement} ringEl
   * @param {HTMLElement} textEl
   * @param {number} target
   * @param {number} duration
   */
  function animateAccuracyRing(ringEl, textEl, target, duration) {
    if (!ringEl || !textEl) return;
    var startTime = 0;
    duration = duration || 900;
    function step(ts) {
      if (!startTime) startTime = ts;
      var progress = Math.min((ts - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.round(target * eased);
      ringEl.style.setProperty('--acc', current);
      textEl.textContent = current + '%';
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /**
   * 构建新难度解锁通知
   * @returns {HTMLElement}
   */
  function buildUnlockNotif() {
    var notif = document.createElement('div');
    notif.className = 'settle-unlock-notif';
    notif.innerHTML =
      '<div class="settle-unlock-icon">🔓</div>' +
      '<div class="settle-unlock-text">' +
        '<div class="settle-unlock-title">新难度解锁！</div>' +
        '<div class="settle-unlock-desc">快去挑战更高的难度吧</div>' +
      '</div>';
    return notif;
  }

  /**
   * 构建新徽章展示区
   * @param {Array} badges
   * @returns {HTMLElement}
   */
  function buildNewBadges(badges) {
    var sec = document.createElement('div');
    sec.className = 'settle-new-badges';
    var html = '<div class="settle-section-title">🏆 获得新徽章</div>';
    badges.forEach(function (b) {
      html +=
        '<div class="settle-new-badge">' +
          '<div class="settle-badge-icon">' + (b.icon || '🏅') + '</div>' +
          '<div class="settle-badge-info">' +
            '<div class="settle-badge-name">' + (b.name || '') + '</div>' +
            '<div class="settle-badge-desc">' + (b.description || '') + '</div>' +
          '</div>' +
        '</div>';
    });
    sec.innerHTML = html;
    return sec;
  }

  /**
   * 构建答题回顾列表（含筛选标签 + 可展开详情）
   * @param {Object} data
   * @returns {HTMLElement}
   */
  function buildReview(data) {
    var review = document.createElement('div');
    review.className = 'settle-review';

    var results = data.results || [];
    var questions = data.questions || [];
    var questionTimes = data.questionTimes || [];
    var correctCount = results.filter(function (r) { return r && r.correct; }).length;
    var wrongCount = results.length - correctCount;

    review.innerHTML = '<div class="settle-section-title">📋 答题回顾</div>';

    // 筛选标签栏
    var filterBar = document.createElement('div');
    filterBar.className = 'settle-filter-bar';
    filterBar.innerHTML =
      '<button class="settle-filter-btn active" data-filter="all">全部 ' +
        '<span class="filter-count">(' + results.length + ')</span></button>' +
      '<button class="settle-filter-btn" data-filter="correct">✓ 对题 ' +
        '<span class="filter-count">(' + correctCount + ')</span></button>' +
      '<button class="settle-filter-btn" data-filter="wrong">✗ 错题 ' +
        '<span class="filter-count">(' + wrongCount + ')</span></button>';
    review.appendChild(filterBar);

    var list = document.createElement('div');
    list.className = 'settle-review-list';

    results.forEach(function (r, idx) {
      var q = questions[idx] || {};
      var correct = !!(r && r.correct);
      var item = document.createElement('div');
      item.className = 'settle-review-item ' + (correct ? 'correct' : 'wrong');
      item.setAttribute('data-result', correct ? 'correct' : 'wrong');

      // 将题目中的 □ 替换为正确答案，显示完整题目
      var fullQuestion = (q.display || '').replace(/\u25A1/g, r.correctAnswer || '?');

      var answersHtml;
      if (correct) {
        answersHtml = '<span class="settle-review-ans ok">✓ ' + r.userAnswer + '</span>';
      } else {
        answersHtml =
          '<span class="settle-review-ans bad">✗ ' + r.userAnswer + '</span>' +
          '<span class="settle-review-ans ok">✓ ' + r.correctAnswer + '</span>';
      }

      // 详情：题型 + 用时
      var qTime = questionTimes[idx];
      var timeText = (qTime != null) ? (qTime + '秒') : '—';
      var detailHtml =
        '<div class="settle-review-detail">' +
          '<span>📌 ' + typeLabel(q.type) + '</span>' +
          '<span>⏱️ 用时 ' + timeText + '</span>' +
        '</div>';

      item.innerHTML =
        '<div class="settle-review-q">' +
          '<span class="settle-review-num">' + (idx + 1) + '</span>' +
          '<span class="settle-review-text">' + fullQuestion + '</span>' +
          '<span class="settle-review-toggle">▼</span>' +
        '</div>' +
        '<div class="settle-review-answers">' + answersHtml + '</div>' +
        detailHtml;

      // 点击展开/收起详情
      item.addEventListener('click', function () {
        item.classList.toggle('expanded');
      });
      list.appendChild(item);
    });
    review.appendChild(list);

    // 空态占位（筛选无结果时显示）
    var empty = document.createElement('div');
    empty.className = 'settle-review-empty';
    empty.id = 'settle-review-empty';
    empty.style.display = 'none';
    empty.textContent = '该筛选下没有题目～';
    review.appendChild(empty);

    // 筛选切换逻辑
    filterBar.addEventListener('click', function (e) {
      var btn = e.target.closest('.settle-filter-btn');
      if (!btn) return;
      safePlay('click');
      var filter = btn.getAttribute('data-filter');
      // 更新按钮 active 状态
      var allBtns = filterBar.querySelectorAll('.settle-filter-btn');
      allBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      // 过滤列表项
      var items = list.querySelectorAll('.settle-review-item');
      var visibleCount = 0;
      items.forEach(function (it) {
        var res = it.getAttribute('data-result');
        var show = (filter === 'all') ||
                   (filter === 'correct' && res === 'correct') ||
                   (filter === 'wrong' && res === 'wrong');
        if (show) {
          it.classList.remove('hidden');
          visibleCount++;
        } else {
          it.classList.add('hidden');
        }
      });
      empty.style.display = visibleCount === 0 ? 'block' : 'none';
    });

    return review;
  }

  /**
   * 构建底部操作按钮
   * @param {Object} data
   * @returns {HTMLElement}
   */
  function buildActions(data) {
    var hasErrors = (data.results || []).some(function (r) { return !r.correct; });
    var actions = document.createElement('div');
    actions.className = 'settle-actions';

    var retryLabel = data.isPractice ? '🔁 再练一组错题' : '🔄 重新刷题';
    var html = '<button class="settle-btn primary" id="settle-retry">' + retryLabel + '</button>';
    if (hasErrors) {
      html += '<button class="settle-btn secondary" id="settle-errors">📕 查看错题</button>';
    }
    html += '<button class="settle-btn secondary" id="settle-home">🏠 返回主页</button>';
    actions.innerHTML = html;
    return actions;
  }

  var Settlement = {
    /**
     * 渲染完整结算页到容器
     * @param {HTMLElement} container
     * @param {Object} data - 结算数据
     */
    show: function (container, data) {
      if (!container) return;
      data = data || {};
      container.innerHTML = '';
      injectStyles();

      var wrapper = document.createElement('div');
      wrapper.className = 'settle-content' + (data.isClear ? ' is-clear' : '');

      // 1. 顶部横幅
      wrapper.appendChild(buildBanner(data));

      // 2. 统计卡片
      wrapper.appendChild(buildStatsCard(data));

      // 3. 新难度解锁通知
      if (data.isClear && data.isNewUnlock) {
        wrapper.appendChild(buildUnlockNotif());
        celebrate('unlock');
      }

      // 4. 新徽章展示
      if (data.newBadges && data.newBadges.length > 0) {
        wrapper.appendChild(buildNewBadges(data.newBadges));
        celebrate('badge');
      }

      // 全对时撒五彩纸屑庆祝
      if (data.isClear) {
        // 稍延后触发，避免与渲染争抢主线程
        setTimeout(function () { celebrate('confetti'); }, 200);
      }

      // 5. 答题回顾
      wrapper.appendChild(buildReview(data));

      // 6. 操作按钮
      wrapper.appendChild(buildActions(data));

      container.appendChild(wrapper);

      // 绑定按钮回调
      var retryBtn = container.querySelector('#settle-retry');
      if (retryBtn && typeof data.onRetry === 'function') {
        retryBtn.addEventListener('click', function () {
          safePlay('click');
          data.onRetry();
        });
      }
      var errorsBtn = container.querySelector('#settle-errors');
      if (errorsBtn && typeof data.onViewErrors === 'function') {
        errorsBtn.addEventListener('click', function () {
          safePlay('click');
          data.onViewErrors();
        });
      }
      var homeBtn = container.querySelector('#settle-home');
      if (homeBtn && typeof data.onHome === 'function') {
        homeBtn.addEventListener('click', function () {
          safePlay('click');
          data.onHome();
        });
      }

      // 触发统计数字滚动动画（延后一帧确保 DOM 已渲染）
      setTimeout(function () {
        var scoring = data.scoring || {};
        var results = data.results || [];
        var total = results.length || 10;
        var correctCount = scoring.correctCount || 0;
        var accuracy = total > 0 ? Math.round(correctCount / total * 100) : 0;
        animateCountUp(container.querySelector('#settle-correct-num'), 900);
        animateCountUp(container.querySelector('#settle-points'), 800);
        animateCountUp(container.querySelector('#settle-streak'), 700);
        animateAccuracyRing(
          container.querySelector('#settle-accuracy-ring'),
          container.querySelector('#settle-accuracy-text'),
          accuracy,
          1000
        );
      }, 80);

      // 滚动到顶部，确保用户从结算页顶部开始阅读
      try {
        container.scrollTop = 0;
        var page = document.getElementById('page-settlement');
        if (page) page.scrollTop = 0;
      } catch (e) { /* 忽略 */ }
    }
  };

  global.Settlement = Settlement;

})(typeof window !== 'undefined' ? window : this);
