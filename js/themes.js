/**
 * themes.js - 主题管理系统模块
 * 儿童数学闯关游戏 - 主题切换、解锁与商店展示
 *
 * 通过全局对象 Themes 暴露接口（window.Themes）
 *
 * 规则：
 *   - 'default' 主题免费且永远解锁
 *   - 其他主题需要消耗积分购买（最低 100 积分）
 *   - 购买时调用 Storage.addPoints(-price) 扣除积分
 *   - 应用主题通过 document.body.setAttribute('data-theme', themeId)
 *   - 同时更新首页吉祥物 emoji（#home-mascot 元素）
 *
 * 依赖全局：Storage、Sound
 */

(function (global) {
  'use strict';

  // 主题定义（顺序即商店展示顺序）
  var DEFINITIONS = [
    { id: 'default', name: '天空蓝',     mascot: '🦊', price: 0,   preview: ['#4A90D9', '#FFB347', '#FF6B9D'] },
    { id: 'meadow',  name: '春日草甸',   mascot: '🐰', price: 120, preview: ['#81C784', '#FFD54F', '#A5D6A7'] },
    { id: 'forest',  name: '森林小动物', mascot: '🐻', price: 100, preview: ['#66BB6A', '#8D6E63', '#A1887F'] },
    { id: 'ocean',   name: '海洋世界',   mascot: '🐬', price: 150, preview: ['#4FC3F7', '#26C6DA', '#80DEEA'] },
    { id: 'candy',   name: '糖果乐园',   mascot: '🦄', price: 200, preview: ['#F48FB1', '#CE93D8', '#FFAB91'] },
    { id: 'school',  name: '校园童趣',   mascot: '🐼', price: 180, preview: ['#FFD54F', '#EF5350', '#66BB6A'] },
    { id: 'sunset',  name: '夕阳晚霞',   mascot: '🦉', price: 220, preview: ['#FF8A65', '#FFAB91', '#FFCC80'] },
    { id: 'starry',  name: '星空数学',   mascot: '🚀', price: 250, preview: ['#5C6BC0', '#FFD54F', '#7E57C2'] }
  ];

  /**
   * 安全调用音效
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
   * 根据 ID 取主题定义
   * @param {string} themeId
   * @returns {Object|null}
   */
  function getDefinition(themeId) {
    for (var i = 0; i < DEFINITIONS.length; i++) {
      if (DEFINITIONS[i].id === themeId) return DEFINITIONS[i];
    }
    return null;
  }

  var Themes = {
    DEFINITIONS: DEFINITIONS,

    /**
     * 获取当前正在使用的主题 ID
     * @returns {string}
     */
    getCurrent: function () {
      try {
        var state = global.Storage.getState();
        return (state && state.currentTheme) || 'default';
      } catch (e) {
        return 'default';
      }
    },

    /**
     * 应用主题：设置 body data-theme 属性 + 持久化 + 更新吉祥物
     * @param {string} themeId
     * @returns {boolean} 是否应用成功
     */
    apply: function (themeId) {
      var def = getDefinition(themeId);
      if (!def) return false;
      // 未解锁的主题不能应用
      if (!Themes.isUnlocked(themeId)) return false;

      try {
        document.body.setAttribute('data-theme', themeId);
        global.Storage.setCurrentTheme(themeId);
      } catch (e) { /* 持久化失败也允许视觉切换 */ }

      // 同步首页吉祥物
      var mascotEl = document.getElementById('home-mascot');
      if (mascotEl) {
        mascotEl.textContent = def.mascot;
      }
      return true;
    },

    /**
     * 判断主题是否已解锁（'default' 永远解锁）
     * @param {string} themeId
     * @returns {boolean}
     */
    isUnlocked: function (themeId) {
      if (themeId === 'default') return true;
      try {
        var state = global.Storage.getState();
        return !!(state && state.unlockedThemes &&
                   state.unlockedThemes.indexOf(themeId) !== -1);
      } catch (e) {
        return false;
      }
    },

    /**
     * 判断用户当前积分是否足够购买指定主题
     * @param {string} themeId
     * @returns {boolean}
     */
    canAfford: function (themeId) {
      var def = getDefinition(themeId);
      if (!def) return false;
      try {
        var state = global.Storage.getState();
        var points = (state && state.points) || 0;
        return points >= def.price;
      } catch (e) {
        return false;
      }
    },

    /**
     * 购买主题：扣分 → 解锁 → 应用
     * @param {string} themeId
     * @returns {boolean} 是否购买成功
     */
    purchase: function (themeId) {
      var def = getDefinition(themeId);
      if (!def) return false;
      // 已解锁的主题无需购买
      if (Themes.isUnlocked(themeId)) return false;
      // 积分不足
      if (!Themes.canAfford(themeId)) return false;

      try {
        // 扣除积分（addPoints 支持负数）
        global.Storage.addPoints(-def.price);
        // 解锁主题
        global.Storage.unlockTheme(themeId);
      } catch (e) {
        return false;
      }
      // 自动应用刚购买的主题
      Themes.apply(themeId);
      // 播放解锁音效以示庆祝
      safePlay('unlock');
      return true;
    },

    /**
     * 渲染主题商店网格到容器
     * @param {HTMLElement} container
     */
    render: function (container) {
      if (!container) return;
      container.innerHTML = '';

      var current = Themes.getCurrent();
      var points = 0;
      try {
        var s = global.Storage.getState();
        points = (s && s.points) || 0;
      } catch (e) { /* 默认 0 */ }

      // 顶部积分余额栏
      var balanceBar = document.createElement('div');
      balanceBar.className = 'theme-balance-bar';
      var pointsDisplay = (points % 1 === 0) ? points : points.toFixed(1);
      balanceBar.innerHTML =
        '<span class="theme-balance-icon">⭐</span>' +
        '<span class="theme-balance-label">我的积分</span>' +
        '<span class="theme-balance-val">' + pointsDisplay + '</span>';
      container.appendChild(balanceBar);

      var grid = document.createElement('div');
      grid.className = 'themes-grid-inner';

      DEFINITIONS.forEach(function (theme) {
        var card = document.createElement('div');
        var isCurrent = (theme.id === current);
        var isUnlocked = Themes.isUnlocked(theme.id);
        var canBuy = !isUnlocked && points >= theme.price;

        card.className = 'theme-card' +
          (isCurrent ? ' current' : '') +
          (isUnlocked ? ' unlocked' : ' locked');
        card.setAttribute('data-theme-id', theme.id);

        // 主题预览色块
        var previewHtml = theme.preview.map(function (c) {
          return '<span class="theme-preview-color" style="background:' + c + '"></span>';
        }).join('');

        // 状态区域：使用中 / 点击使用 / 购买按钮 / 积分不足提示
        var actionHtml = '';
        if (isCurrent) {
          actionHtml = '<span class="theme-status using">使用中</span>';
        } else if (isUnlocked) {
          actionHtml = '<button class="theme-use-btn" data-theme="' + theme.id + '">点击使用</button>';
        } else if (canBuy) {
          actionHtml = '<button class="theme-buy-btn" data-theme="' + theme.id + '">' +
                        '购买 ' + theme.price + '⭐</button>';
        } else {
          actionHtml = '<span class="theme-status locked">需要 ' + theme.price + '⭐</span>';
        }

        card.innerHTML =
          '<div class="theme-mascot">' + theme.mascot + '</div>' +
          '<div class="theme-name">' + theme.name + '</div>' +
          '<div class="theme-preview">' + previewHtml + '</div>' +
          '<div class="theme-action">' + actionHtml + '</div>';

        grid.appendChild(card);
      });

      container.appendChild(grid);

      // 绑定「点击使用」按钮
      var useBtns = container.querySelectorAll('.theme-use-btn');
      useBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-theme');
          Themes.apply(id);
          safePlay('click');
          Themes.render(container);
        });
      });

      // 绑定「购买」按钮
      var buyBtns = container.querySelectorAll('.theme-buy-btn');
      buyBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-theme');
          if (Themes.purchase(id)) {
            Themes.render(container);
          } else {
            // 积分不足时给一个友好提示（不阻塞 UI）
            safePlay('wrong');
          }
        });
      });
    }
  };

  global.Themes = Themes;

})(typeof window !== 'undefined' ? window : this);
