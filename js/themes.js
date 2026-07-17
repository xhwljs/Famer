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
    { id: 'default', name: '天空蓝',     mascot: '🦊', price: 0,   desc: '清新明亮的天空蓝，小狐狸陪你学习', preview: ['#4A90D9', '#FFB347', '#FF6B9D'] },
    { id: 'meadow',  name: '春日草甸',   mascot: '🐰', price: 120, desc: '嫩绿草地的春天气息，小兔子蹦蹦跳', preview: ['#81C784', '#FFD54F', '#A5D6A7'] },
    { id: 'forest',  name: '森林小动物', mascot: '🐻', price: 100, desc: '森林里的小熊陪你闯关', preview: ['#66BB6A', '#8D6E63', '#A1887F'] },
    { id: 'ocean',   name: '海洋世界',   mascot: '🐬', price: 150, desc: '蓝色海洋，海豚跃出水面', preview: ['#4FC3F7', '#26C6DA', '#80DEEA'] },
    { id: 'candy',   name: '糖果乐园',   mascot: '🦄', price: 200, desc: '粉色糖果梦幻世界，独角兽出没', preview: ['#F48FB1', '#CE93D8', '#FFAB91'] },
    { id: 'school',  name: '校园童趣',   mascot: '🐼', price: 180, desc: '校园风的活泼配色，熊猫同学报到', preview: ['#FFD54F', '#EF5350', '#66BB6A'] },
    { id: 'sunset',  name: '夕阳晚霞',   mascot: '🦉', price: 220, desc: '温暖的夕阳色彩，猫头鹰守夜', preview: ['#FF8A65', '#FFAB91', '#FFCC80'] },
    { id: 'starry',  name: '星空数学',   mascot: '🚀', price: 250, desc: '神秘星空，火箭探索宇宙', preview: ['#5C6BC0', '#FFD54F', '#7E57C2'] }
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

  /**
   * 显示轻量 toast 提示（自动消失）
   * @param {string} msg - HTML 内容
   * @param {string} [type] - 'success' | 'warn' | 'info'
   */
  var toastTimer = null;
  function showToast(msg, type) {
    var el = document.getElementById('theme-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'theme-toast';
      el.className = 'theme-toast';
      document.body.appendChild(el);
    }
    el.className = 'theme-toast ' + (type || 'info');
    el.innerHTML = msg;
    // 触发重绘以重启动画
    void el.offsetWidth;
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('show');
    }, 2200);
  }

  /**
   * 显示购买确认模态框
   * @param {Object} theme - 主题定义
   * @param {number} balance - 当前积分
   * @param {function} onConfirm - 确认回调
   */
  function showConfirmModal(theme, balance, onConfirm) {
    // 遮罩
    var overlay = document.createElement('div');
    overlay.className = 'theme-confirm-overlay';
    var after = balance - theme.price;
    overlay.innerHTML =
      '<div class="theme-confirm-modal">' +
        '<div class="tcm-mascot">' + theme.mascot + '</div>' +
        '<div class="tcm-title">购买「' + theme.name + '」？</div>' +
        '<div class="tcm-desc">' + (theme.desc || '') + '</div>' +
        '<div class="tcm-price-row">' +
          '<span class="tcm-cost">- ' + theme.price + ' ⭐</span>' +
          '<span class="tcm-arrow">→</span>' +
          '<span class="tcm-after' + (after < 0 ? ' negative' : '') + '">余额 ' + after + ' ⭐</span>' +
        '</div>' +
        '<div class="tcm-actions">' +
          '<button class="tcm-btn tcm-cancel" type="button">再想想</button>' +
          '<button class="tcm-btn tcm-ok" type="button">确认购买</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    // 触发进场动画
    requestAnimationFrame(function () { overlay.classList.add('show'); });

    var close = function () {
      overlay.classList.remove('show');
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 200);
    };
    overlay.querySelector('.tcm-cancel').addEventListener('click', function () {
      safePlay('click');
      close();
    });
    overlay.querySelector('.tcm-ok').addEventListener('click', function () {
      close();
      if (typeof onConfirm === 'function') onConfirm();
    });
    // 点击遮罩外部关闭
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
  }

  // 当前筛选标签（模块级状态，跨 render 保持）
  var currentFilter = 'all';

  /**
   * 将 #RRGGBB 转为 rgba(r,g,b,a) 字符串
   * @param {string} hex
   * @param {number} alpha
   * @returns {string}
   */
  function hexToRgba(hex, alpha) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    var r = parseInt(h.substring(0, 2), 16) || 0;
    var g = parseInt(h.substring(2, 4), 16) || 0;
    var b = parseInt(h.substring(4, 6), 16) || 0;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
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
        '<span class="theme-balance-val">' + pointsDisplay + '</span>' +
        '<span class="theme-balance-tip">多做题目赚积分解锁更多主题哦～</span>';
      container.appendChild(balanceBar);

      // 筛选标签栏
      var filterBar = document.createElement('div');
      filterBar.className = 'theme-filter-bar';
      var filters = [
        { id: 'all',      label: '全部' },
        { id: 'owned',    label: '已拥有' },
        { id: 'free',     label: '免费' },
        { id: 'buyable',  label: '可购买' },
        { id: 'locked',   label: '未解锁' }
      ];
      filters.forEach(function (f) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'theme-filter-btn' + (currentFilter === f.id ? ' active' : '');
        btn.setAttribute('data-filter', f.id);
        btn.textContent = f.label;
        btn.addEventListener('click', function () {
          safePlay('click');
          currentFilter = f.id;
          Themes.render(container);
        });
        filterBar.appendChild(btn);
      });
      container.appendChild(filterBar);

      var grid = document.createElement('div');
      grid.className = 'themes-grid-inner';

      var visibleCount = 0;
      DEFINITIONS.forEach(function (theme) {
        var isCurrent = (theme.id === current);
        var isUnlocked = Themes.isUnlocked(theme.id);
        var canBuy = !isUnlocked && points >= theme.price;

        // 筛选逻辑
        var match = true;
        if (currentFilter === 'owned')   match = isUnlocked;
        else if (currentFilter === 'free')    match = (theme.price === 0);
        else if (currentFilter === 'buyable') match = (!isUnlocked && canBuy);
        else if (currentFilter === 'locked')  match = (!isUnlocked && !canBuy);
        if (!match) return;
        visibleCount++;

        var card = document.createElement('div');
        card.className = 'theme-card' +
          (isCurrent ? ' current' : '') +
          (isUnlocked ? ' unlocked' : ' locked') +
          (canBuy ? ' buyable' : '');
        card.setAttribute('data-theme-id', theme.id);

        // 主题预览色块
        var previewHtml = theme.preview.map(function (c) {
          return '<span class="theme-preview-color" style="background:' + c + '"></span>';
        }).join('');

        // 状态徽标
        var badgeHtml = '';
        if (isCurrent) badgeHtml = '<span class="theme-badge using">使用中</span>';
        else if (theme.price === 0) badgeHtml = '<span class="theme-badge free">免费</span>';
        else if (isUnlocked) badgeHtml = '<span class="theme-badge owned">已拥有</span>';

        // 状态区域：使用中 / 点击使用 / 购买按钮 / 积分不足提示
        var actionHtml = '';
        if (isCurrent) {
          actionHtml = '<span class="theme-status using">✓ 使用中</span>';
        } else if (isUnlocked) {
          actionHtml = '<button class="theme-use-btn" data-theme="' + theme.id + '">点击使用</button>';
        } else if (canBuy) {
          actionHtml = '<button class="theme-buy-btn" data-theme="' + theme.id + '">' +
                        '购买 ' + theme.price + '⭐</button>';
        } else {
          actionHtml = '<span class="theme-status locked">还需 ' + (theme.price - Math.floor(points)) + '⭐</span>';
        }

        card.innerHTML =
          badgeHtml +
          '<div class="theme-mascot">' + theme.mascot + '</div>' +
          '<div class="theme-name">' + theme.name + '</div>' +
          '<div class="theme-desc">' + (theme.desc || '') + '</div>' +
          '<div class="theme-preview">' + previewHtml + '</div>' +
          '<div class="theme-action">' + actionHtml + '</div>';

        grid.appendChild(card);
      });

      container.appendChild(grid);

      // 筛选无结果时显示空态
      if (visibleCount === 0) {
        var empty = document.createElement('div');
        empty.className = 'theme-empty';
        empty.innerHTML = '<span class="theme-empty-icon">🔍</span><span>该分类下暂无主题</span>';
        container.appendChild(empty);
      }

      // 绑定「点击使用」按钮
      var useBtns = container.querySelectorAll('.theme-use-btn');
      useBtns.forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var id = btn.getAttribute('data-theme');
          Themes.apply(id);
          safePlay('click');
          showToast('✨ 已切换为「' + getDefinition(id).name + '」', 'success');
          Themes.render(container);
        });
      });

      // 绑定「购买」按钮
      var buyBtns = container.querySelectorAll('.theme-buy-btn');
      buyBtns.forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var id = btn.getAttribute('data-theme');
          var def = getDefinition(id);
          if (!def) return;
          // 二次确认
          showConfirmModal(def, Math.floor(points), function () {
            if (Themes.purchase(id)) {
              showToast('🎉 购买成功！「' + def.name + '」已解锁并应用', 'success');
              Themes.render(container);
            } else {
              safePlay('wrong');
              showToast('❌ 购买失败，积分不足', 'warn');
              Themes.render(container);
            }
          });
        });
      });

      // 卡片点击预览（悬停/触摸吉祥物临时预览背景配色，松开恢复）
      var cards = container.querySelectorAll('.theme-card');
      cards.forEach(function (card) {
        var themeId = card.getAttribute('data-theme-id');
        var def = getDefinition(themeId);
        if (!def) return;
        var previewing = false;
        var applyPreview = function () {
          if (themeId === Themes.getCurrent()) return;
          if (previewing) return;
          previewing = true;
          card.classList.add('previewing');
          // 临时给 #app 叠加一层该主题主色的半透明渐变作为预览
          var app = document.getElementById('app');
          if (app && def.preview && def.preview.length > 0) {
            var c1 = def.preview[0];
            var c2 = def.preview[1] || c1;
            app.style.setProperty('--preview-bg',
              'linear-gradient(135deg, ' + hexToRgba(c1, 0.28) + ', ' + hexToRgba(c2, 0.28) + ')');
            app.classList.add('theme-preview-active');
          }
        };
        var removePreview = function () {
          if (!previewing) return;
          previewing = false;
          card.classList.remove('previewing');
          var app = document.getElementById('app');
          if (app) {
            app.style.removeProperty('--preview-bg');
            app.classList.remove('theme-preview-active');
          }
        };
        // 桌面端：鼠标悬停吉祥物预览
        var mascotEl = card.querySelector('.theme-mascot');
        if (mascotEl) {
          mascotEl.addEventListener('mouseenter', applyPreview);
          mascotEl.addEventListener('mouseleave', removePreview);
          // 移动端：触摸预览
          mascotEl.addEventListener('touchstart', function (ev) {
            ev.preventDefault();
            applyPreview();
          }, { passive: false });
          mascotEl.addEventListener('touchend', removePreview);
          mascotEl.addEventListener('touchcancel', removePreview);
        }
      });
    }
  };

  global.Themes = Themes;

})(typeof window !== 'undefined' ? window : this);
