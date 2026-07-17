/**
 * home.js - 首页今日学习进度卡片渲染模块
 * 儿童数学闯关游戏
 *
 * 依赖全局：Storage
 */

(function (global) {
  'use strict';

  var HomePage = {

    /**
     * 渲染今日学习进度卡片
     */
    renderTodayProgress: function () {
      var container = document.getElementById('today-progress-card');
      if (!container) return;

      var state = global.Storage.getState();
      var history = state.sessionHistory || [];
      var today = new Date();
      var todayStr = today.getFullYear() + '-' +
                     String(today.getMonth() + 1).padStart(2, '0') + '-' +
                     String(today.getDate()).padStart(2, '0');

      // 统计今日数据
      var todaySessions = 0;
      var todayCorrect = 0;
      var todayTotal = 0;
      var todayPoints = 0;

      history.forEach(function (r) {
        if (!r.timestamp) return;
        var d = new Date(r.timestamp);
        var dStr = d.getFullYear() + '-' +
                   String(d.getMonth() + 1).padStart(2, '0') + '-' +
                   String(d.getDate()).padStart(2, '0');
        if (dStr === todayStr) {
          todaySessions++;
          todayCorrect += (r.correct || 0);
          todayTotal += (r.total || 0);
          todayPoints += (r.points || 0);
        }
      });

      // 今日无记录时显示鼓励语
      if (todaySessions === 0) {
        container.innerHTML =
          '<div class="today-card-inner empty">' +
            '<span class="today-icon">🌅</span>' +
            '<span class="today-text">今天还没有做题哦，快来开始吧！</span>' +
          '</div>';
        return;
      }

      var accuracy = todayTotal > 0 ? Math.round(todayCorrect / todayTotal * 100) : 0;
      // 连续学习天数与历史最长
      var streak = state.studyStreak || 0;
      var bestStreak = state.bestStudyStreak || 0;
      // 连胜奖励提示：3/7/14/30 天为里程碑
      var milestoneTips = {
        3: '再坚持 1 天解锁连胜奖励！',
        7: '🎉 7天连胜达成，真棒！',
        14: '🎊 14天连胜，学霸就是你！',
        30: '👑 30天连胜，数学小达人！'
      };
      var streakHint = milestoneTips[streak] || '';
      var streakBadge =
        '<div class="today-streak-badge' + (streak > 0 ? ' active' : '') + '">' +
          '<span class="streak-flame">🔥</span>' +
          '<span class="streak-num">' + streak + '</span>' +
          '<span class="streak-unit">天连胜</span>' +
          (bestStreak > streak ? '<span class="streak-best">（最佳' + bestStreak + '天）</span>' : '') +
        '</div>';
      container.innerHTML =
        '<div class="today-card-inner">' +
          '<div class="today-title">📊 今日学习</div>' +
          streakBadge +
          (streakHint ? '<div class="today-streak-hint">' + streakHint + '</div>' : '') +
          '<div class="today-stats">' +
            '<div class="today-stat"><span class="today-stat-val">' + todaySessions + '</span><span class="today-stat-label">组数</span></div>' +
            '<div class="today-stat"><span class="today-stat-val">' + todayCorrect + '</span><span class="today-stat-label">答对</span></div>' +
            '<div class="today-stat"><span class="today-stat-val">' + accuracy + '%</span><span class="today-stat-label">正确率</span></div>' +
            '<div class="today-stat"><span class="today-stat-val">+' + todayPoints + '</span><span class="today-stat-label">积分</span></div>' +
          '</div>' +
        '</div>';
    }
  };

  global.HomePage = HomePage;

})(typeof window !== 'undefined' ? window : this);
