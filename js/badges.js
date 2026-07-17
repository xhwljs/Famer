/**
 * badges.js - 成就徽章系统模块
 * 儿童数学闯关游戏 - 自动解锁与展示成就徽章
 *
 * 通过全局对象 Badges 暴露接口（window.Badges）
 *
 * 徽章类别：
 *   - 通关类：first_steps / master_20 / master_50 / master_100
 *   - 单局表现类：perfect_star / streak_king
 *   - 累计类：diligent_50 / diligent_100 / diligent_200 / points_500
 *
 * 数据来源：Storage.getState() 中的 badges（已解锁 ID 数组）、
 *           totalQuestions、points 等字段
 *
 * 依赖全局：Storage、Sound
 */

(function (global) {
  'use strict';

  // 徽章定义（顺序即展示顺序）
  var DEFINITIONS = [
    { id: 'first_steps',   name: '初出茅庐',     icon: '👣', description: '完成第一组答题' },
    { id: 'master_20',     name: '二十小能手',   icon: '🌱', description: '通关20以内难度' },
    { id: 'master_50',     name: '五十小达人',   icon: '🌿', description: '通关50以内难度' },
    { id: 'master_100',    name: '百数小天才',   icon: '🌳', description: '通关100以内难度' },
    { id: 'perfect_star',  name: '十题全对之星', icon: '⭐', description: '单次组题全部答对' },
    { id: 'streak_king',    name: '连续闯关王者', icon: '👑', description: '连续3组题目全部通关' },
    { id: 'diligent_50',   name: '刷题小勤奋',   icon: '📝', description: '累计答题50题' },
    { id: 'diligent_100',  name: '刷题达人',     icon: '📖', description: '累计答题100题' },
    { id: 'diligent_200',  name: '做题高手',     icon: '📚', description: '累计答题200题' },
    { id: 'points_500',   name: '积分小富翁',   icon: '💎', description: '累计获得500积分' }
  ];

  /**
   * 安全调用音效（吞掉异常，避免阻塞主流程）
   * @param {string} type
   */
  function safePlay(type) {
    try {
      if (global.Sound && typeof global.Sound.play === 'function') {
        global.Sound.play(type);
      }
    } catch (e) { /* 忽略音频错误 */ }
  }

  /**
   * 判断指定徽章是否已解锁（直接读 Storage 状态）
   * @param {string} id
   * @returns {boolean}
   */
  function isUnlockedInStorage(id) {
    try {
      var state = global.Storage.getState();
      return !!(state && state.badges && state.badges.indexOf(id) !== -1);
    } catch (e) {
      return false;
    }
  }

  /**
   * 判断某难度是否已通关（读 Storage 状态）
   * @param {number} level
   * @returns {boolean}
   */
  function isLevelCompleted(level) {
    try {
      var state = global.Storage.getState();
      return !!(state && state.difficulty && state.difficulty[level] &&
                 state.difficulty[level].completed);
    } catch (e) {
      return false;
    }
  }

  /**
   * 判断单个徽章是否满足解锁条件
   * @param {string} id - 徽章 ID
   * @param {Object} data - 已规整化的会话数据
   * @returns {boolean}
   */
  function shouldUnlock(id, data) {
    switch (id) {
      case 'first_steps':    return data.totalQuestions >= 1;
      case 'master_20':      return isLevelCompleted(20);
      case 'master_50':      return isLevelCompleted(50);
      case 'master_100':     return isLevelCompleted(100);
      case 'perfect_star':   return data.isFullClear === true;
      case 'streak_king':    return (data.consecutiveClears || 0) >= 3;
      case 'diligent_50':    return data.totalQuestions >= 50;
      case 'diligent_100':   return data.totalQuestions >= 100;
      case 'diligent_200':   return data.totalQuestions >= 200;
      case 'points_500':     return data.totalPoints >= 500;
      default:               return false;
    }
  }

  var Badges = {
    DEFINITIONS: DEFINITIONS,

    /**
     * 检查所有徽章的解锁状态
     * @param {Object} sessionData - 当前会话数据
     *   { level, correctCount, total, isFullClear, pointsEarned,
     *     totalQuestions, totalPoints, consecutiveClears }
     * @returns {Array} 本次新解锁的徽章对象数组（用于结算页庆祝展示）
     */
    check: function (sessionData) {
      sessionData = sessionData || {};
      // 规整化字段，避免 undefined 参与比较
      var data = {
        level: sessionData.level || null,
        isFullClear: sessionData.isFullClear === true,
        totalQuestions: sessionData.totalQuestions || 0,
        totalPoints: sessionData.totalPoints || 0,
        consecutiveClears: sessionData.consecutiveClears || 0
      };

      var newlyUnlocked = [];
      for (var i = 0; i < DEFINITIONS.length; i++) {
        var def = DEFINITIONS[i];
        // 已解锁的徽章跳过
        if (isUnlockedInStorage(def.id)) continue;
        // 不满足条件则跳过
        if (!shouldUnlock(def.id, data)) continue;

        // 调用 Storage 解锁并持久化
        try {
          var isNew = global.Storage.unlockBadge(def.id);
          if (isNew) {
            newlyUnlocked.push(def);
          }
        } catch (e) { /* 持久化失败时静默忽略 */ }
      }

      // 任意新徽章解锁都播放徽章音效
      if (newlyUnlocked.length > 0) {
        safePlay('badge');
      }
      return newlyUnlocked;
    },

    /**
     * 获取所有徽章及其解锁状态
     * @returns {Array} 形如 [{...def, unlocked: bool}]
     */
    getAll: function () {
      var result = [];
      for (var i = 0; i < DEFINITIONS.length; i++) {
        var def = DEFINITIONS[i];
        // 浅拷贝避免外部修改 DEFINITIONS
        var copy = {
          id: def.id,
          name: def.name,
          icon: def.icon,
          description: def.description,
          unlocked: isUnlockedInStorage(def.id)
        };
        result.push(copy);
      }
      return result;
    },

    /**
     * 查询某个徽章是否已解锁
     * @param {string} id
     * @returns {boolean}
     */
    isUnlocked: function (id) {
      return isUnlockedInStorage(id);
    },

    /**
     * 渲染徽章网格到容器
     * @param {HTMLElement} container - 容器元素
     */
    render: function (container) {
      if (!container) return;
      container.innerHTML = '';

      var all = Badges.getAll();
      var unlockedCount = 0;

      all.forEach(function (badge) {
        if (badge.unlocked) unlockedCount++;

        var card = document.createElement('div');
        card.className = 'badge-card' + (badge.unlocked ? ' unlocked' : ' locked');
        card.setAttribute('data-badge-id', badge.id);

        // 徽章图标：已解锁显示真实图标，未解锁显示锁定占位（单一锁标识，避免三重叠加）
        var iconChar = badge.unlocked ? badge.icon : '🔒';
        card.innerHTML =
          '<div class="badge-icon">' + iconChar + '</div>' +
          '<div class="badge-name">' + badge.name + '</div>' +
          '<div class="badge-desc">' + badge.description + '</div>';

        container.appendChild(card);
      });

      // 同步更新首页徽章计数（若存在该元素）
      var homeCountEl = document.getElementById('home-badge-count');
      if (homeCountEl) {
        homeCountEl.textContent = String(unlockedCount);
      }
    }
  };

  global.Badges = Badges;

})(typeof window !== 'undefined' ? window : this);
