/**
 * storage.js - localStorage 持久化存储模块
 * 儿童数学闯关游戏 - 游戏数据存储
 *
 * 使用命名空间前缀 "mathWorld_" 隔离存储数据，避免与其他应用冲突
 * 通过全局对象 Storage 暴露接口（window.Storage）
 *
 * 默认游戏状态结构：
 * {
 *   points: 0,              // 总积分
 *   totalQuestions: 0,       // 累计答题数
 *   totalCorrect: 0,         // 累计答对数
 *   difficulty: {            // 各难度状态
 *     20:  { unlocked, completed, bestStreak },
 *     50:  { unlocked, completed, bestStreak },
 *     100: { unlocked, completed, bestStreak }
 *   },
 *   currentTheme: 'default', // 当前主题
 *   unlockedThemes: ['default'], // 已解锁主题
 *   badges: [],              // 已获得徽章 ID
 *   errorBook: { 20: [], 50: [], 100: [] }, // 错题本（按难度分）
 *   consecutiveClears: 0,    // 连续通关次数
 *   sessionHistory: []       // 最近会话记录
 * }
 */

(function (global) {
  'use strict';

  // 命名空间前缀
  var PREFIX = 'mathWorld_';

  // 状态总键名
  var STATE_KEY = 'state';

  // 最多保留的会话历史条数
  var MAX_SESSION_HISTORY = 50;

  /**
   * 创建一份默认游戏状态
   * @returns {Object} 默认状态对象
   */
  function createDefaultState() {
    return {
      points: 0,
      totalQuestions: 0,
      totalCorrect: 0,
      difficulty: {
        20:  { unlocked: true,  completed: false, bestStreak: 0, clearCount: 0 },
        50:  { unlocked: false, completed: false, bestStreak: 0, clearCount: 0 },
        100: { unlocked: false, completed: false, bestStreak: 0, clearCount: 0 }
      },
      currentTheme: 'default',
      unlockedThemes: ['default'],
      badges: [],
      errorBook: { 20: [], 50: [], 100: [] },
      consecutiveClears: 0,
      sessionHistory: [],
      lastDailyRewardDate: '',  // 每日首次答题奖励记录（格式 YYYY-MM-DD）
      studyStreak: 0,           // 连续学习天数
      lastStudyDate: '',        // 最近一次学习日期（格式 YYYY-MM-DD）
      bestStudyStreak: 0        // 历史最长连续学习天数
    };
  }

  /**
   * 读取原始字符串值
   * @param {string} key - 不含前缀的键名
   * @returns {string|null}
   */
  function readRaw(key) {
    try {
      return global.localStorage.getItem(PREFIX + key);
    } catch (e) {
      return null;
    }
  }

  /**
   * 写入原始字符串值
   * @param {string} key - 不含前缀的键名
   * @param {string} value
   * @returns {boolean} 是否成功
   */
  function writeRaw(key, value) {
    try {
      global.localStorage.setItem(PREFIX + key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * 删除原始键值
   * @param {string} key - 不含前缀的键名
   */
  function removeRaw(key) {
    try {
      global.localStorage.removeItem(PREFIX + key);
    } catch (e) {
      /* 忽略 */
    }
  }

  /**
   * 合并默认值，补全可能缺失的字段（向前兼容旧版本数据）
   * @param {Object} state - 已存储的状态
   * @returns {Object} 补全后的状态
   */
  function mergeDefaults(state) {
    if (!state || typeof state !== 'object') {
      return createDefaultState();
    }
    var defaults = createDefaultState();

    if (typeof state.points !== 'number') state.points = defaults.points;
    if (typeof state.totalQuestions !== 'number') state.totalQuestions = defaults.totalQuestions;
    if (typeof state.totalCorrect !== 'number') state.totalCorrect = defaults.totalCorrect;
    if (typeof state.currentTheme !== 'string') state.currentTheme = defaults.currentTheme;
    if (!Array.isArray(state.unlockedThemes)) state.unlockedThemes = defaults.unlockedThemes.slice();
    if (!Array.isArray(state.badges)) state.badges = [];
    if (typeof state.consecutiveClears !== 'number') state.consecutiveClears = 0;
    if (!Array.isArray(state.sessionHistory)) state.sessionHistory = [];
    if (typeof state.lastDailyRewardDate !== 'string') state.lastDailyRewardDate = '';
    if (typeof state.studyStreak !== 'number') state.studyStreak = 0;
    if (typeof state.lastStudyDate !== 'string') state.lastStudyDate = '';
    if (typeof state.bestStudyStreak !== 'number') state.bestStudyStreak = 0;

    // difficulty 各等级补全
    if (!state.difficulty) state.difficulty = defaults.difficulty;
    [20, 50, 100].forEach(function (lv) {
      if (!state.difficulty[lv]) {
        state.difficulty[lv] = defaults.difficulty[lv];
      } else {
        var d = state.difficulty[lv];
        if (typeof d.unlocked !== 'boolean') d.unlocked = defaults.difficulty[lv].unlocked;
        if (typeof d.completed !== 'boolean') d.completed = defaults.difficulty[lv].completed;
        if (typeof d.bestStreak !== 'number') d.bestStreak = 0;
        if (typeof d.clearCount !== 'number') d.clearCount = 0;  // 通关次数（向后兼容）
      }
    });

    // errorBook 各难度补全
    if (!state.errorBook) state.errorBook = defaults.errorBook;
    [20, 50, 100].forEach(function (lv) {
      if (!Array.isArray(state.errorBook[lv])) state.errorBook[lv] = [];
    });

    return state;
  }

  var Storage = {
    /**
     * 读取单个键值（自动反序列化 JSON）
     * @param {string} key - 键名（不含前缀）
     * @param {*} defaultValue - 默认值
     * @returns {*} 存储值或默认值
     */
    get: function (key, defaultValue) {
      var raw = readRaw(key);
      if (raw === null) {
        return defaultValue;
      }
      try {
        return JSON.parse(raw);
      } catch (e) {
        return defaultValue;
      }
    },

    /**
     * 写入单个键值（自动序列化 JSON）
     * @param {string} key - 键名（不含前缀）
     * @param {*} value - 值
     * @returns {boolean} 是否成功
     */
    set: function (key, value) {
      try {
        return writeRaw(key, JSON.stringify(value));
      } catch (e) {
        return false;
      }
    },

    /**
     * 删除单个键值
     * @param {string} key - 键名（不含前缀）
     */
    remove: function (key) {
      removeRaw(key);
    },

    /**
     * 获取完整游戏状态
     * @returns {Object} 游戏状态对象
     */
    getState: function () {
      var state = Storage.get(STATE_KEY, null);
      if (!state) {
        state = createDefaultState();
        Storage.saveState(state);
        return state;
      }
      return mergeDefaults(state);
    },

    /**
     * 保存完整游戏状态
     * @param {Object} state - 游戏状态对象
     */
    saveState: function (state) {
      Storage.set(STATE_KEY, state);
    },

    /**
     * 增加积分
     * @param {number} amount - 增加的积分数（可为小数）
     */
    addPoints: function (amount) {
      var state = Storage.getState();
      state.points += amount;
      // 积分不允许为负（兜底，避免扣分异常导致负数）
      if (state.points < 0) state.points = 0;
      // 规避浮点累加误差
      state.points = Math.round(state.points * 100) / 100;
      Storage.saveState(state);
    },

    /**
     * 记录一次答题情况
     * @param {boolean} correct - 是否答对
     */
    addQuestionAnswered: function (correct) {
      var state = Storage.getState();
      state.totalQuestions += 1;
      if (correct) {
        state.totalCorrect += 1;
      }
      Storage.saveState(state);
    },

    /**
     * 解锁难度等级
     * @param {number} level - 难度等级（20/50/100）
     */
    unlockDifficulty: function (level) {
      var state = Storage.getState();
      if (state.difficulty[level]) {
        state.difficulty[level].unlocked = true;
        Storage.saveState(state);
      }
    },

    /**
     * 标记难度等级为已通关，并增加通关次数
     * @param {number} level - 难度等级
     */
    completeDifficulty: function (level) {
      var state = Storage.getState();
      if (state.difficulty[level]) {
        state.difficulty[level].completed = true;
        state.difficulty[level].clearCount = (state.difficulty[level].clearCount || 0) + 1;
        Storage.saveState(state);
      }
    },

    /**
     * 获取某难度的通关次数
     * @param {number} level - 难度等级
     * @returns {number}
     */
    getClearCount: function (level) {
      var state = Storage.getState();
      return (state.difficulty[level] && state.difficulty[level].clearCount) || 0;
    },

    /**
     * 检查并领取每日首次答题奖励
     * @returns {boolean} 是否领取成功（true=今天首次）
     */
    claimDailyReward: function () {
      var state = Storage.getState();
      var today = new Date();
      var todayStr = today.getFullYear() + '-' +
                     String(today.getMonth() + 1).padStart(2, '0') + '-' +
                     String(today.getDate()).padStart(2, '0');
      if (state.lastDailyRewardDate === todayStr) {
        return false; // 今天已领取过
      }
      state.lastDailyRewardDate = todayStr;
      state.points += 1; // 每日首次答题额外+1积分
      state.points = Math.round(state.points * 100) / 100;
      Storage.saveState(state);
      return true;
    },

    /**
     * 更新某难度的最佳连胜记录（仅当新记录更高时更新）
     * @param {number} level - 难度等级
     * @param {number} streak - 本次连胜数
     */
    updateBestStreak: function (level, streak) {
      var state = Storage.getState();
      if (state.difficulty[level] && streak > state.difficulty[level].bestStreak) {
        state.difficulty[level].bestStreak = streak;
        Storage.saveState(state);
      }
    },

    /**
     * 解锁徽章
     * @param {string} badgeId - 徽章 ID
     * @returns {boolean} 是否为新解锁（true 表示本次新增）
     */
    unlockBadge: function (badgeId) {
      var state = Storage.getState();
      if (state.badges.indexOf(badgeId) === -1) {
        state.badges.push(badgeId);
        Storage.saveState(state);
        return true;
      }
      return false;
    },

    /**
     * 解锁主题
     * @param {string} themeId - 主题 ID
     * @returns {boolean} 是否为新解锁
     */
    unlockTheme: function (themeId) {
      var state = Storage.getState();
      if (state.unlockedThemes.indexOf(themeId) === -1) {
        state.unlockedThemes.push(themeId);
        Storage.saveState(state);
        return true;
      }
      return false;
    },

    /**
     * 设置当前使用的主题
     * @param {string} themeId - 主题 ID
     */
    setCurrentTheme: function (themeId) {
      var state = Storage.getState();
      state.currentTheme = themeId;
      Storage.saveState(state);
    },

    /**
     * 添加错题记录
     * @param {number} level - 难度等级
     * @param {Object} errorData - 错题数据 { question, userAnswer, correctAnswer, type, timestamp }
     */
    addError: function (level, errorData) {
      var state = Storage.getState();
      if (!state.errorBook[level]) {
        state.errorBook[level] = [];
      }
      state.errorBook[level].push(errorData);
      Storage.saveState(state);
    },

    /**
     * 获取某难度的错题列表
     * @param {number} level - 难度等级
     * @returns {Array} 错题数组
     */
    getErrors: function (level) {
      var state = Storage.getState();
      return state.errorBook[level] || [];
    },

    /**
     * 清空某难度的错题
     * @param {number} level - 难度等级
     */
    clearErrors: function (level) {
      var state = Storage.getState();
      if (state.errorBook[level]) {
        state.errorBook[level] = [];
        Storage.saveState(state);
      }
    },

    /**
     * 增加连续通关次数
     */
    incrementConsecutiveClears: function () {
      var state = Storage.getState();
      state.consecutiveClears += 1;
      Storage.saveState(state);
    },

    /**
     * 重置连续通关次数
     */
    resetConsecutiveClears: function () {
      var state = Storage.getState();
      state.consecutiveClears = 0;
      Storage.saveState(state);
    },

    /**
     * 添加一次会话结果记录
     * @param {Object} result - { level, correct, total, points, streak, timestamp }
     */
    addSessionResult: function (result) {
      var state = Storage.getState();
      state.sessionHistory.push(result);
      // 仅保留最近 N 条，避免存储膨胀
      if (state.sessionHistory.length > MAX_SESSION_HISTORY) {
        state.sessionHistory = state.sessionHistory.slice(-MAX_SESSION_HISTORY);
      }
      Storage.saveState(state);
    },

    /**
     * 获取今日日期字符串（YYYY-MM-DD）
     * @returns {string}
     */
    getTodayStr: function () {
      var d = new Date();
      return d.getFullYear() + '-' +
             String(d.getMonth() + 1).padStart(2, '0') + '-' +
             String(d.getDate()).padStart(2, '0');
    },

    /**
     * 获取昨天日期字符串（YYYY-MM-DD）
     * @returns {string}
     */
    getYesterdayStr: function () {
      var d = new Date();
      d.setDate(d.getDate() - 1);
      return d.getFullYear() + '-' +
             String(d.getMonth() + 1).padStart(2, '0') + '-' +
             String(d.getDate()).padStart(2, '0');
    },

    /**
     * 更新连续学习天数：每日首次答题时调用
     * - 今天已记录则不重复
     * - 昨天有学习记录则 +1
     * - 否则重置为 1
     * - 同步刷新历史最长记录
     * @returns {number} 当前的连续学习天数（0 表示今日已记录未更新）
     */
    updateStudyStreak: function () {
      var state = Storage.getState();
      var today = Storage.getTodayStr();
      if (state.lastStudyDate === today) {
        return 0; // 今日已记录
      }
      var yesterday = Storage.getYesterdayStr();
      if (state.lastStudyDate === yesterday) {
        state.studyStreak += 1;
      } else {
        state.studyStreak = 1;
      }
      state.lastStudyDate = today;
      if (state.studyStreak > state.bestStudyStreak) {
        state.bestStudyStreak = state.studyStreak;
      }
      Storage.saveState(state);
      return state.studyStreak;
    },

    /**
     * 重置所有数据（测试用，恢复默认状态）
     */
    reset: function () {
      removeRaw(STATE_KEY);
      Storage.saveState(createDefaultState());
    }
  };

  global.Storage = Storage;

})(typeof window !== 'undefined' ? window : this);
