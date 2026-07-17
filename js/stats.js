/**
 * stats.js - 数据档案页渲染模块
 * 儿童数学闯关游戏 - 成长档案展示与数据重置
 *
 * 依赖全局：Storage, Difficulty, Badges, ErrorBook, Themes, Sound
 */

(function (global) {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function safePlay(type) {
    try { global.Sound.play(type); } catch (e) { /* 忽略 */ }
  }

  var StatsPage = {

    /**
     * 渲染数据档案页
     * @param {function} onResetHome - 数据重置后回调（返回首页）
     */
    render: function (onResetHome) {
      var container = $('stats-container');
      if (!container) return;
      container.innerHTML = '';

      var state = global.Storage.getState();
      var accuracy = state.totalQuestions > 0
        ? Math.round(state.totalCorrect / state.totalQuestions * 100)
        : 0;

      // 总览卡片
      var overview = document.createElement('div');
      overview.className = 'card stats-overview-card';
      overview.innerHTML =
        '<div class="stats-overview-row">' +
          '<div class="stats-overview-item">' +
            '<div class="stats-overview-icon">📝</div>' +
            '<div class="stats-overview-val">' + state.totalQuestions + '</div>' +
            '<div class="stats-overview-label">累计答题</div>' +
          '</div>' +
          '<div class="stats-overview-item">' +
            '<div class="stats-overview-icon">✅</div>' +
            '<div class="stats-overview-val">' + state.totalCorrect + '</div>' +
            '<div class="stats-overview-label">答对题数</div>' +
          '</div>' +
          '<div class="stats-overview-item">' +
            '<div class="stats-overview-icon">🎯</div>' +
            '<div class="stats-overview-val">' + accuracy + '%</div>' +
            '<div class="stats-overview-label">正确率</div>' +
          '</div>' +
        '</div>';
      container.appendChild(overview);

      // 积分 & 徽章卡片
      var pointsCard = document.createElement('div');
      pointsCard.className = 'card stats-points-card';
      pointsCard.innerHTML =
        '<div class="stats-row">' +
          '<span class="stats-row-icon">⭐</span>' +
          '<span class="stats-row-label">总积分</span>' +
          '<span class="stats-row-val">' + Math.floor(state.points) + '</span>' +
        '</div>' +
        '<div class="stats-row">' +
          '<span class="stats-row-icon">🏅</span>' +
          '<span class="stats-row-label">已获徽章</span>' +
          '<span class="stats-row-val">' + (state.badges ? state.badges.length : 0) + '/' +
            global.Badges.DEFINITIONS.length + '</span>' +
        '</div>' +
        '<div class="stats-row">' +
          '<span class="stats-row-icon">🔥</span>' +
          '<span class="stats-row-label">连续通关</span>' +
          '<span class="stats-row-val">' + state.consecutiveClears + '</span>' +
        '</div>';
      container.appendChild(pointsCard);

      // 难度通关卡片
      var diffCard = document.createElement('div');
      diffCard.className = 'card stats-diff-card';
      var diffHtml = '<div class="stats-section-title">📚 难度进度</div>';
      global.Difficulty.LEVELS.forEach(function (lv) {
        var info = state.difficulty[lv.id] || {};
        var statusText = '';
        var statusClass = '';
        if (!info.unlocked) {
          statusText = '🔒 未解锁';
          statusClass = 'locked';
        } else if (info.completed) {
          statusText = '✅ 已通关';
          statusClass = 'completed';
        } else {
          statusText = '🔓 进行中';
          statusClass = 'progress';
        }
        diffHtml +=
          '<div class="stats-diff-row ' + statusClass + '">' +
            '<span class="stats-diff-icon">' + lv.icon + '</span>' +
            '<span class="stats-diff-name">' + lv.name + '</span>' +
            '<span class="stats-diff-streak">最高连击 ' + (info.bestStreak || 0) + '</span>' +
            '<span class="stats-diff-status">' + statusText + '</span>' +
          '</div>';
      });
      diffCard.innerHTML = diffHtml;
      container.appendChild(diffCard);

      // 错题统计
      var totalErrors = global.ErrorBook.getTotalCount();
      var errorCard = document.createElement('div');
      errorCard.className = 'card stats-error-card';
      errorCard.innerHTML =
        '<div class="stats-section-title">📕 错题统计</div>' +
        '<div class="stats-error-row"><span>20以内错题</span><span>' + global.ErrorBook.getCount(20) + ' 道</span></div>' +
        '<div class="stats-error-row"><span>50以内错题</span><span>' + global.ErrorBook.getCount(50) + ' 道</span></div>' +
        '<div class="stats-error-row"><span>100以内错题</span><span>' + global.ErrorBook.getCount(100) + ' 道</span></div>' +
        '<div class="stats-error-total">合计 ' + totalErrors + ' 道错题</div>';
      container.appendChild(errorCard);

      // 最近记录
      var history = state.sessionHistory || [];
      if (history.length > 0) {
        var histCard = document.createElement('div');
        histCard.className = 'card stats-history-card';
        var histHtml = '<div class="stats-section-title">📋 最近记录</div>';
        var recent = history.slice(-5).reverse();
        recent.forEach(function (r) {
          var d = new Date(r.timestamp || Date.now());
          var timeStr = (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
                        d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
          var passText = r.correct === r.total ? '通关' : (r.correct + '/' + r.total);
          histHtml +=
            '<div class="stats-history-row">' +
              '<span class="hist-level">' + r.level + '以内</span>' +
              '<span class="hist-result">' + passText + '</span>' +
              '<span class="hist-points">+' + r.points + '⭐</span>' +
              '<span class="hist-time">' + timeStr + '</span>' +
            '</div>';
        });
        histCard.innerHTML = histHtml;
        container.appendChild(histCard);
      }

      // 数据重置卡片
      var resetCard = document.createElement('div');
      resetCard.className = 'card stats-reset-card';
      resetCard.innerHTML =
        '<div class="stats-section-title">⚙️ 设置</div>' +
        '<button class="btn btn-danger btn-block" id="reset-data-btn">重置所有数据</button>' +
        '<p class="reset-warning">⚠️ 将清空所有积分、徽章、错题和进度，不可恢复！</p>';
      container.appendChild(resetCard);

      // 绑定重置按钮
      var resetBtn = $('reset-data-btn');
      if (resetBtn) {
        resetBtn.addEventListener('click', function () {
          if (global.confirm('确定要重置所有数据吗？\n\n这将清空：\n· 所有积分和徽章\n· 难度解锁进度\n· 错题本记录\n· 已解锁的主题\n\n此操作不可恢复！')) {
            global.Storage.reset();
            global.Themes.apply('default');
            var icon = $('sound-icon');
            if (icon) icon.textContent = '🔊';
            safePlay('click');
            if (typeof onResetHome === 'function') onResetHome();
          }
        });
      }
    }
  };

  global.StatsPage = StatsPage;

})(typeof window !== 'undefined' ? window : this);
