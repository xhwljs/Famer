/**
 * keyboard.js - 九宫格数字键盘组件
 * 儿童数学闯关游戏 - 适配儿童手指的大尺寸按键
 *
 * 通过全局对象 Keyboard 暴露接口（window.Keyboard）
 *
 * 三种布局类型（对应 QuestionGenerator 的 answerType）：
 *   'number' - 数字键盘：1-9 + ⌫ + 0 + ✓（3x4）
 *   'symbol' - 符号键盘：＞ ＜ / ＝ ⌫ / ✓（用于比大小题）
 *   'mixed'   - 混合键盘：数字 0-9 + 符号 + ⌫ + ✓
 *
 * 设计要点：
 *   - 按键最小 60x60px，便于儿童点击
 *   - 黏土风格（claymorphism）：圆角 + 厚边 + 柔和阴影
 *   - 按下时缩放至 0.9 提供触觉反馈
 *   - 每次按键播放 Sound.play('click')
 *   - 内部维护 currentInput 字符串状态
 *
 * 依赖全局：Sound
 */

(function (global) {
  'use strict';

  // 数字键盘布局（3 列 × 4 行）
  var NUMBER_LAYOUT = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['⌫', '0', '✓']
  ];

  // 符号键盘布局（2 列 × 3 行，最后一行全宽确认键）
  var SYMBOL_LAYOUT = [
    ['＞', '＜'],
    ['＝', '⌫'],
    ['✓']
  ];

  // 混合键盘布局（3 列 × 5 行）
  var MIXED_LAYOUT = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['＞', '＜', '＝'],
    ['⌫', '0', '✓']
  ];

  // 内部状态（模块级单例）
  var currentInput = '';
  var callbacks = { onKey: null, onSubmit: null };
  var activeType = 'number';
  // 内联样式是否已注入（保证组件在 CSS 缺失时也能呈现基本可用外观）
  var stylesInjected = false;

  /**
   * 安全播放音效
   */
  function safePlay(type) {
    try {
      if (global.Sound && typeof global.Sound.play === 'function') {
        global.Sound.play(type);
      }
    } catch (e) { /* 忽略 */ }
  }

  /**
   * 注入键盘所需的最小内联样式（保证可用性，不依赖外部 CSS 是否就绪）
   */
  function injectStyles() {
    if (stylesInjected) return;
    if (document.getElementById('kb-inline-styles')) {
      stylesInjected = true;
      return;
    }
    var style = document.createElement('style');
    style.id = 'kb-inline-styles';
    style.textContent =
      '.keyboard{display:flex;flex-direction:column;gap:10px;padding:8px;width:100%;}' +
      '.kb-row{display:flex;gap:10px;justify-content:space-between;}' +
      '.kb-key{' +
        'flex:1;min-width:60px;min-height:60px;border:3px solid var(--color-border,#D9E6F2);' +
        'border-radius:20px;background:var(--color-card,#FFFFFF);' +
        'font-family:var(--font-heading,system-ui);font-size:clamp(1.4rem,5vw,1.8rem);' +
        'font-weight:700;color:var(--color-text,#3A3A5C);' +
        'box-shadow:0 6px 12px rgba(58,58,92,0.10),inset 0 -3px 6px rgba(58,58,92,0.05),inset 0 3px 6px rgba(255,255,255,0.8);' +
        'transition:transform 80ms ease-out,box-shadow 80ms ease-out;' +
        'display:flex;align-items:center;justify-content:center;' +
        '-webkit-user-select:none;user-select:none;' +
      '}' +
      '.kb-key.kb-wide{flex:2;}' +
      '.kb-key.kb-special{background:var(--color-primary,#4A90D9);color:#FFFFFF;border-color:var(--color-primary-dark,#3A78B8);}' +
      '.kb-key.kb-confirm{background:var(--color-success,#6BCB77);color:#FFFFFF;border-color:#4FA958;}' +
      '.kb-key.pressed{transform:scale(0.9);box-shadow:0 2px 5px rgba(58,58,92,0.18),inset 0 2px 6px rgba(58,58,92,0.12);}' +
      '.kb-symbol .kb-key{font-size:clamp(1.8rem,7vw,2.4rem);min-height:72px;}';
    document.head.appendChild(style);
    stylesInjected = true;
  }

  /**
   * 创建单个按键元素
   * @param {string} label - 按键文本
   * @param {Object} opts - { wide, special, confirm }
   * @returns {HTMLButtonElement}
   */
  function createKey(label, opts) {
    opts = opts || {};
    var key = document.createElement('button');
    key.className = 'kb-key';
    key.setAttribute('type', 'button');
    key.setAttribute('data-key', label);
    key.textContent = label;

    if (opts.wide) key.classList.add('kb-wide');
    if (opts.confirm) key.classList.add('kb-confirm');
    if (opts.special) key.classList.add('kb-special');

    // 触摸 / 鼠标统一处理（防止重复触发）
    var pressed = false;
    var handlePress = function (e) {
      if (e) e.preventDefault();
      if (pressed) return; // 防止 touchstart + mousedown 重复
      pressed = true;
      key.classList.add('pressed');
      safePlay('click');
      handleKeyAction(label);
      setTimeout(function () {
        key.classList.remove('pressed');
        pressed = false;
      }, 120);
    };

    key.addEventListener('touchstart', handlePress, { passive: false });
    key.addEventListener('mousedown', handlePress);

    return key;
  }

  /**
   * 处理按键动作：更新 currentInput 并触发回调
   * @param {string} label
   */
  function handleKeyAction(label) {
    if (label === '⌫') {
      // 退格：移除最后一个字符
      currentInput = currentInput.slice(0, -1);
    } else if (label === '✓') {
      // 确认：触发 onSubmit，不再修改输入
      if (callbacks.onSubmit) callbacks.onSubmit(currentInput);
      return;
    } else {
      // 普通字符：追加
      currentInput += label;
    }
    // 通知调用方输入已变化
    if (callbacks.onKey) callbacks.onKey(currentInput);
  }

  /**
   * 根据类型选择布局
   * @param {string} type
   * @returns {Array}
   */
  function getLayout(type) {
    if (type === 'symbol') return SYMBOL_LAYOUT;
    if (type === 'mixed') return MIXED_LAYOUT;
    return NUMBER_LAYOUT;
  }

  var Keyboard = {
    /**
     * 在容器中渲染键盘
     * @param {HTMLElement} container
     * @param {Object} options - { type, onKey, onSubmit }
     */
    show: function (container, options) {
      if (!container) return;
      options = options || {};
      // 先清空旧键盘与状态
      Keyboard.hide(container);

      injectStyles();

      activeType = options.type || 'number';
      callbacks = {
        onKey: typeof options.onKey === 'function' ? options.onKey : null,
        onSubmit: typeof options.onSubmit === 'function' ? options.onSubmit : null
      };
      currentInput = '';

      var kb = document.createElement('div');
      kb.className = 'keyboard keyboard-' + activeType;

      var layout = getLayout(activeType);
      layout.forEach(function (row) {
        var rowEl = document.createElement('div');
        rowEl.className = 'kb-row';
        row.forEach(function (label) {
          // 空字符串占位跳过
          if (label === '' || label == null) return;
          var opts = { wide: false, special: false, confirm: false };
          if (label === '⌫') opts.special = true;
          if (label === '✓') opts.confirm = true;
          // 单元素行视为全宽按钮
          if (row.length === 1) opts.wide = true;
          rowEl.appendChild(createKey(label, opts));
        });
        kb.appendChild(rowEl);
      });

      container.appendChild(kb);
    },

    /**
     * 从容器中移除键盘并清理状态
     * @param {HTMLElement} container
     */
    hide: function (container) {
      if (container) container.innerHTML = '';
      currentInput = '';
      callbacks = { onKey: null, onSubmit: null };
    },

    /**
     * 获取当前输入字符串
     * @returns {string}
     */
    getCurrentInput: function () {
      return currentInput;
    },

    /**
     * 设置当前输入（覆盖式）
     * @param {string} value
     */
    setInput: function (value) {
      currentInput = String(value == null ? '' : value);
      if (callbacks.onKey) callbacks.onKey(currentInput);
    },

    /**
     * 清空当前输入
     */
    clear: function () {
      currentInput = '';
      if (callbacks.onKey) callbacks.onKey(currentInput);
    }
  };

  global.Keyboard = Keyboard;

})(typeof window !== 'undefined' ? window : this);
