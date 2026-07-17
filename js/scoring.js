/**
 * scoring.js - 积分计算模块
 * 儿童数学闯关游戏 - 答题积分与连胜统计
 *
 * 通过全局对象 Scoring 暴露接口（window.Scoring）
 *
 * 积分规则：
 *   - 基础分：每题答对得 0.5 分
 *   - 连胜加成：连续答对超过 5 题后，从第 6 题起每题得 1 分
 *   - 全对加成：10 题全对额外 +2 分（与基础分叠加）
 *   - 连胜中断后重新计数
 *
 * 返回结构：
 *   { totalPoints, maxStreak, correctCount, isFullClear }
 */

(function (global) {
  'use strict';

  // 积分配置常量
  var BASE_POINTS = 0.5;          // 基础每题得分
  var STREAK_BONUS_POINTS = 1.0;  // 连胜加成后每题得分
  var STREAK_THRESHOLD = 5;       // 触发连胜加成的连对阈值（超过此值后加成）
  var FULL_CLEAR_BONUS = 2;       // 全对额外奖励
  var TOTAL_QUESTIONS = 10;       // 一组题目数量

  var Scoring = {
    /**
     * 计算一组题目的积分与统计
     * @param {Array} results - 答题结果数组，每项形如 { correct: bool }
     * @returns {Object} { totalPoints, maxStreak, correctCount, isFullClear }
     */
    calculate: function (results) {
      results = results || [];
      var totalPoints = 0;
      var maxStreak = 0;
      var currentStreak = 0;
      var correctCount = 0;

      for (var i = 0; i < results.length; i++) {
        var isCorrect = !!(results[i] && results[i].correct);
        if (isCorrect) {
          correctCount++;
          currentStreak++;
          // 连续答对超过阈值后，每题给加成分；否则给基础分
          if (currentStreak > STREAK_THRESHOLD) {
            totalPoints += STREAK_BONUS_POINTS;
          } else {
            totalPoints += BASE_POINTS;
          }
          // 更新最大连胜
          if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
          }
        } else {
          // 答错：连胜中断，重新计数
          currentStreak = 0;
        }
      }

      // 全对加成：10 题全部答对
      var isFullClear = (correctCount === TOTAL_QUESTIONS &&
                         results.length === TOTAL_QUESTIONS);
      if (isFullClear) {
        totalPoints += FULL_CLEAR_BONUS;
      }

      // 规避浮点累加误差，保留两位小数
      totalPoints = Math.round(totalPoints * 100) / 100;

      return {
        totalPoints: totalPoints,
        maxStreak: maxStreak,
        correctCount: correctCount,
        isFullClear: isFullClear
      };
    }
  };

  global.Scoring = Scoring;

})(typeof window !== 'undefined' ? window : this);
