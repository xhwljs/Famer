/**
 * error-book.js - 错题本模块
 * 儿童数学闯关游戏 - 错题收集、按难度分组展示与清空
 *
 * 通过全局对象 ErrorBook 暴露接口（window.ErrorBook）
 *
 * 数据结构：
 *   Storage.errorBook = { 20: [...], 50: [...], 100: [...] }
 *   每条错题：{ display, userAnswer, correctAnswer, type, timestamp }
 *
 * 依赖全局：Storage
 */

(function (global) {
  'use strict';

  // 支持的难度等级
  var LEVELS = [20, 50, 100];

  /**
   * 规整化难度值（容忍字符串传入）
   * @param {number|string} level
   * @returns {number}
   */
  function normalizeLevel(level) {
    var n = parseInt(level, 10);
    if (LEVELS.indexOf(n) === -1) return 20; // 未知则回退到 20
    return n;
  }

  var ErrorBook = {
    /**
     * 添加一条错题记录
     * @param {number} level - 难度等级 20/50/100
     * @param {Object} errorData - { display, userAnswer, correctAnswer, type, timestamp }
     */
    add: function (level, errorData) {
      var lv = normalizeLevel(level);
      var data = {
        display: errorData.display || '',
        userAnswer: errorData.userAnswer,
        correctAnswer: errorData.correctAnswer,
        type: errorData.type || 'basic',
        timestamp: errorData.timestamp || Date.now()
      };
      try {
        global.Storage.addError(lv, data);
      } catch (e) { /* 持久化失败时静默忽略 */ }
    },

    /**
     * 获取指定难度的所有错题
     * @param {number} level
     * @returns {Array}
     */
    getByLevel: function (level) {
      var lv = normalizeLevel(level);
      try {
        return global.Storage.getErrors(lv) || [];
      } catch (e) {
        return [];
      }
    },

    /**
     * 获取所有难度的错题，按 level 分组返回
     * @returns {Object} { 20: [], 50: [], 100: [] }
     */
    getAll: function () {
      var result = {};
      LEVELS.forEach(function (lv) {
        result[lv] = ErrorBook.getByLevel(lv);
      });
      return result;
    },

    /**
     * 获取指定难度的错题数
     * @param {number} level
     * @returns {number}
     */
    getCount: function (level) {
      return ErrorBook.getByLevel(level).length;
    },

    /**
     * 获取所有难度的错题总数
     * @returns {number}
     */
    getTotalCount: function () {
      var total = 0;
      LEVELS.forEach(function (lv) {
        total += ErrorBook.getCount(lv);
      });
      return total;
    },

    /**
     * 清空指定难度的错题
     * @param {number} level
     */
    clearLevel: function (level) {
      var lv = normalizeLevel(level);
      try {
        global.Storage.clearErrors(lv);
      } catch (e) { /* 忽略 */ }
    },

    /**
     * 渲染指定难度的错题列表到容器
     * @param {HTMLElement} container
     * @param {number} level
     */
    render: function (container, level) {
      if (!container) return;
      container.innerHTML = '';

      var lv = normalizeLevel(level);
      var errors = ErrorBook.getByLevel(lv);

      // 空状态：友好的鼓励文案
      if (errors.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'error-empty';
        empty.innerHTML =
          '<div class="error-empty-icon">🎉</div>' +
          '<p class="error-empty-text">还没有错题哦，继续加油！</p>';
        container.appendChild(empty);
        return;
      }

      // 顶部工具条：错题数 + 清空按钮
      var toolbar = document.createElement('div');
      toolbar.className = 'error-toolbar';
      toolbar.innerHTML =
        '<span class="error-count-text">共 ' + errors.length + ' 道错题</span>' +
        '<button class="error-clear-btn" data-level="' + lv + '">清空</button>';
      container.appendChild(toolbar);

      toolbar.querySelector('.error-clear-btn').addEventListener('click', function () {
        // 使用原生 confirm，避免引入额外 UI 依赖
        if (global.confirm && global.confirm('确定要清空该难度的错题吗？')) {
          ErrorBook.clearLevel(lv);
          ErrorBook.render(container, lv);
          // 同步刷新 tab 上的计数
          var tabsEl = document.getElementById('error-book-tabs');
          if (tabsEl) ErrorBook.renderTabs(tabsEl, lv);
        }
      });

      // 错题列表
      var list = document.createElement('div');
      list.className = 'error-list';

      // 倒序展示（最新错题在前）
      for (var i = errors.length - 1; i >= 0; i--) {
        var err = errors[i];
        var card = document.createElement('div');
        card.className = 'error-card';

        // 格式化时间戳为 M/D HH:MM
        var d = new Date(err.timestamp || Date.now());
        var timeStr = (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
                      d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');

        // 将题目中的 □ 替换为正确答案，显示完整题目
        var fullQuestion = (err.display || '').replace(/\u25A1/g, err.correctAnswer || '?');

        card.innerHTML =
          '<div class="error-question">' + fullQuestion + '</div>' +
          '<div class="error-answers">' +
            '<div class="error-wrong">' +
              '<span class="error-label">你的答案</span>' +
              '<span class="error-value">' + err.userAnswer + '</span>' +
            '</div>' +
            '<div class="error-correct">' +
              '<span class="error-label">正确答案</span>' +
              '<span class="error-value">' + err.correctAnswer + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="error-time">' + timeStr + '</div>';
        list.appendChild(card);
      }
      container.appendChild(list);
    },

    /**
     * 渲染难度切换 Tab（含错题计数）
     * @param {HTMLElement} container
     * @param {number} activeLevel - 当前选中的难度
     */
    renderTabs: function (container, activeLevel) {
      if (!container) return;
      container.innerHTML = '';

      var active = normalizeLevel(activeLevel);
      LEVELS.forEach(function (lv) {
        var tab = document.createElement('button');
        tab.className = 'tab-btn' + (lv === active ? ' active' : '');
        tab.setAttribute('data-level', String(lv));
        tab.innerHTML = lv + '以内 <span class="tab-count">' +
                        ErrorBook.getCount(lv) + '</span>';
        container.appendChild(tab);
      });
    }
  };

  global.ErrorBook = ErrorBook;

})(typeof window !== 'undefined' ? window : this);
