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
        '60%{transform:scale(1.08);opacity:1;}100%{transform:scale(1);}}';
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
    var banner = document.createElement('div');
    banner.className = 'settle-banner ' + (isClear ? 'success' : 'normal');
    banner.innerHTML =
      '<div class="settle-banner-emoji">' + (isClear ? '🎉' : '💪') + '</div>' +
      '<h2 class="settle-banner-title">' + (isClear ? '太棒了！' : '继续加油！') + '</h2>' +
      '<p class="settle-banner-sub">' + (data.level || '') + '以内 · ' +
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
    var maxStreak = scoring.maxStreak || 0;
    var isClear = data.isClear;

    var card = document.createElement('div');
    card.className = 'settle-stats-card';
    card.innerHTML =
      '<div class="settle-main-stat">' +
        '<div class="settle-correct-num">' + correctCount +
          '<span class="settle-total">/' + total + '</span>' +
        '</div>' +
        '<div class="settle-accuracy-ring" style="--acc:' + accuracy + '">' +
          '<span>' + accuracy + '%</span>' +
        '</div>' +
      '</div>' +
      '<div class="settle-stats-row">' +
        '<div class="settle-stat">' +
          '<span class="settle-stat-icon">⭐</span>' +
          '<span class="settle-stat-val">' + points + '</span>' +
          '<span class="settle-stat-label">积分</span>' +
        '</div>' +
        '<div class="settle-stat">' +
          '<span class="settle-stat-icon">🔥</span>' +
          '<span class="settle-stat-val">' + maxStreak + '</span>' +
          '<span class="settle-stat-label">最高连击</span>' +
        '</div>' +
        '<div class="settle-stat">' +
          '<span class="settle-stat-icon">' + (isClear ? '🏆' : '📝') + '</span>' +
          '<span class="settle-stat-val">' + (isClear ? '通关' : '未过') + '</span>' +
          '<span class="settle-stat-label">状态</span>' +
        '</div>' +
      '</div>';
    return card;
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
   * 构建答题回顾列表
   * @param {Object} data
   * @returns {HTMLElement}
   */
  function buildReview(data) {
    var review = document.createElement('div');
    review.className = 'settle-review';
    review.innerHTML = '<div class="settle-section-title">📋 答题回顾</div>';

    var list = document.createElement('div');
    list.className = 'settle-review-list';

    var results = data.results || [];
    var questions = data.questions || [];
    results.forEach(function (r, idx) {
      var q = questions[idx] || {};
      var correct = !!(r && r.correct);
      var item = document.createElement('div');
      item.className = 'settle-review-item ' + (correct ? 'correct' : 'wrong');

      var answersHtml;
      if (correct) {
        answersHtml = '<span class="settle-review-ans ok">✓ ' + r.userAnswer + '</span>';
      } else {
        answersHtml =
          '<span class="settle-review-ans bad">✗ ' + r.userAnswer + '</span>' +
          '<span class="settle-review-ans ok">✓ ' + r.correctAnswer + '</span>';
      }

      item.innerHTML =
        '<div class="settle-review-q">' +
          '<span class="settle-review-num">' + (idx + 1) + '</span>' +
          '<span class="settle-review-text">' + (q.display || '') + '</span>' +
        '</div>' +
        '<div class="settle-review-answers">' + answersHtml + '</div>';
      list.appendChild(item);
    });
    review.appendChild(list);
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

    var html = '<button class="settle-btn primary" id="settle-retry">🔄 重新刷题</button>';
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
