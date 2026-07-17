/**
 * question-generator.js - 题目生成引擎
 * 儿童数学闯关游戏 - 一二年级数学题生成
 *
 * 通过全局对象 QuestionGenerator 暴露接口（window.QuestionGenerator）
 *
 * 三种题型：
 *   'basic'    - 基础加减法：2 + 2 = □
 *   'fillblank'- 填空题：3 + □ = 5 或 □ - 2 = 4
 *   'compare'  - 比大小：7 □ 6（答案为 '>'、'<'、'='）
 *
 * 难度规则：
 *   20  - 数字与结果均在 0-20
 *   50  - 数字与结果均在 0-50
 *   100 - 数字与结果均在 0-100
 *
 * 安全保证：减法永不产生负数（始终 a >= b）
 * 唯一性保证：同一组题目内不重复（以 text 为键去重）
 */

(function (global) {
  'use strict';

  // 难度对应的最大数值范围
  var LEVEL_MAX = { 20: 20, 50: 50, 100: 100 };

  // 三种题型池
  var TYPE_POOL = ['basic', 'fillblank', 'compare'];

  // 答案占位符（U+25A1 白色方框）
  var PLACEHOLDER = '\u25A1';

  /**
   * 工具函数：返回 [min, max] 之间的随机整数（包含两端）
   */
  function randInt(min, max) {
    if (max < min) { var t = min; min = max; max = t; }
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 工具函数：Fisher-Yates 数组洗牌（原地）
   */
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /**
   * 解析难度对应的最大值（容错处理）
   * @param {number} level - 难度等级
   * @returns {number}
   */
  function resolveMax(level) {
    var max = LEVEL_MAX[level];
    if (!max) {
      // 容错：未知等级时取数值本身作为上界
      max = (typeof level === 'number' && level > 0) ? level : 20;
    }
    return max;
  }

  var QuestionGenerator = {
    /**
     * 生成一组题目
     * @param {number} level - 难度等级 20/50/100
     * @param {number} count - 题目数量（默认 10）
     * @returns {Array} 题目对象数组
     */
    generate: function (level, count) {
      var max = resolveMax(level);
      count = count || 10;
      var questions = [];
      var usedKeys = {}; // 用于组内去重

      // 第一轮：带去重生成
      var maxAttempts = count * 20;
      var attempts = 0;
      while (questions.length < count && attempts < maxAttempts) {
        attempts++;
        var type = TYPE_POOL[randInt(0, TYPE_POOL.length - 1)];
        var q = generateOne(type, max);
        if (!q) continue;
        var key = q.text; // 以纯文本作为唯一性键
        if (usedKeys[key]) continue;
        usedKeys[key] = true;
        questions.push(q);
      }

      // 兜底：若因去重导致数量不足，放宽去重补足
      attempts = 0;
      while (questions.length < count && attempts < maxAttempts) {
        attempts++;
        var t2 = TYPE_POOL[randInt(0, TYPE_POOL.length - 1)];
        var q2 = generateOne(t2, max);
        if (q2) questions.push(q2);
      }

      // 打乱最终顺序，确保题型分布随机
      return shuffle(questions).slice(0, count);
    }
  };

  /**
   * 生成单道题目（按题型分发）
   * @param {string} type - 题型
   * @param {number} max - 数值上限
   * @returns {Object|null} 题目对象
   */
  function generateOne(type, max) {
    if (type === 'basic') return generateBasic(max);
    if (type === 'fillblank') return generateFillBlank(max);
    if (type === 'compare') return generateCompare(max);
    return null;
  }

  /**
   * 基础加减法：a + b = □ 或 a - b = □
   * 操作数与结果均在 [0, max]，减法保证 a >= b
   * @param {number} max
   * @returns {Object}
   */
  function generateBasic(max) {
    var operator = Math.random() < 0.5 ? '+' : '-';
    var a, b, result;
    if (operator === '+') {
      // 加法：保证 a + b <= max
      a = randInt(0, max);
      b = randInt(0, max - a);
      result = a + b;
    } else {
      // 减法：保证 a >= b，结果非负
      a = randInt(0, max);
      b = randInt(0, a);
      result = a - b;
    }
    return {
      type: 'basic',
      display: a + ' ' + operator + ' ' + b + ' = ' + PLACEHOLDER,
      text: a + operator + b + '=',
      answer: result,
      answerType: 'number',
      operand1: a,
      operand2: b,
      operator: operator
    };
  }

  /**
   * 填空题：随机把空格放在运算符前或后
   * 形如 3 + □ = 5 或 □ - 2 = 4
   * 答案为被挖去的那个操作数
   * @param {number} max
   * @returns {Object}
   */
  function generateFillBlank(max) {
    var operator = Math.random() < 0.5 ? '+' : '-';
    var a, b, result, answer, display, text;
    if (operator === '+') {
      // 加法 a + b = result，结果 <= max
      a = randInt(0, max);
      b = randInt(0, max - a);
      result = a + b;
      if (Math.random() < 0.5) {
        // 3 + □ = 5 → 答案为 b
        answer = b;
        display = a + ' ' + operator + ' ' + PLACEHOLDER + ' = ' + result;
        text = a + operator + PLACEHOLDER + '=' + result;
      } else {
        // □ + 3 = 5 → 答案为 a
        answer = a;
        display = PLACEHOLDER + ' ' + operator + ' ' + b + ' = ' + result;
        text = PLACEHOLDER + operator + b + '=' + result;
      }
    } else {
      // 减法 a - b = result，a >= b，a <= max
      a = randInt(0, max);
      b = randInt(0, a);
      result = a - b;
      if (Math.random() < 0.5) {
        // a - □ = result → 答案为 b
        answer = b;
        display = a + ' ' + operator + ' ' + PLACEHOLDER + ' = ' + result;
        text = a + operator + PLACEHOLDER + '=' + result;
      } else {
        // □ - b = result → 答案为 a
        answer = a;
        display = PLACEHOLDER + ' ' + operator + ' ' + b + ' = ' + result;
        text = PLACEHOLDER + operator + b + '=' + result;
      }
    }
    return {
      type: 'fillblank',
      display: display,
      text: text,
      answer: answer,
      answerType: 'number',
      operand1: a,
      operand2: b,
      operator: operator
    };
  }

  /**
   * 比大小：a □ b，答案为 '>'、'<' 或 '='
   * 两数均在 [0, max]，约 1/3 概率相等
   * @param {number} max
   * @returns {Object}
   */
  function generateCompare(max) {
    var a = randInt(0, max);
    var b = randInt(0, max);
    // 约 1/3 概率让两数相等，使 '=' 答案合理出现
    if (Math.random() < 0.33) {
      b = a;
    }
    var answer;
    if (a > b) {
      answer = '>';
    } else if (a < b) {
      answer = '<';
    } else {
      answer = '=';
    }
    return {
      type: 'compare',
      display: a + ' ' + PLACEHOLDER + ' ' + b,
      text: a + PLACEHOLDER + b,
      answer: answer,
      answerType: 'symbol',
      operand1: a,
      operand2: b,
      operator: '?'
    };
  }

  global.QuestionGenerator = QuestionGenerator;

})(typeof window !== 'undefined' ? window : this);
