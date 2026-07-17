/**
 * difficulty.js - 难度等级管理模块
 * 儿童数学闯关游戏 - 关卡解锁与状态管理
 *
 * 通过全局对象 Difficulty 暴露接口（window.Difficulty）
 * 依赖 Storage 模块进行持久化（storage.js 须先加载）
 *
 * 关卡规则：
 *   - 20 以内：默认解锁，适合入门
 *   - 50 以内：通关 20 以内（10 题全对）后解锁
 *   - 100 以内：通关 50 以内后解锁
 *   - 已通关关卡可无限重玩
 */

(function (global) {
  'use strict';

  var Difficulty = {
    /**
     * 难度等级配置
     * id     - 关卡标识（即数值范围上限）
     * name   - 显示名称
     * icon   - 图标 emoji
     * color  - 主题色
     * description - 描述文案
     */
    LEVELS: [
      { id: 20,  name: '20以内',  icon: '🌱', color: '#4CAF50', description: '适合入门学习' },
      { id: 50,  name: '50以内',  icon: '🌿', color: '#2196F3', description: '进阶挑战' },
      { id: 100, name: '100以内', icon: '🌳', color: '#FF9800', description: '高手闯关' }
    ],

    /**
     * 获取所有关卡的状态（从 Storage 读取）
     * @returns {Object} 形如 { 20: {...}, 50: {...}, 100: {...} }
     */
    getStatus: function () {
      var state = global.Storage.getState();
      return state.difficulty;
    },

    /**
     * 判断关卡是否已解锁
     * @param {number} level - 关卡 ID
     * @returns {boolean}
     */
    isUnlocked: function (level) {
      var status = Difficulty.getStatus();
      return !!(status[level] && status[level].unlocked);
    },

    /**
     * 判断关卡是否已通关
     * @param {number} level - 关卡 ID
     * @returns {boolean}
     */
    isCompleted: function (level) {
      var status = Difficulty.getStatus();
      return !!(status[level] && status[level].completed);
    },

    /**
     * 判断关卡是否可访问（即已解锁；已通关仍可重玩）
     * @param {number} level - 关卡 ID
     * @returns {boolean}
     */
    canAccess: function (level) {
      return Difficulty.isUnlocked(level);
    },

    /**
     * 解锁关卡（在前一关通关后调用）
     * @param {number} level - 关卡 ID
     */
    unlock: function (level) {
      global.Storage.unlockDifficulty(level);
    },

    /**
     * 标记关卡为已通关
     * @param {number} level - 关卡 ID
     */
    complete: function (level) {
      global.Storage.completeDifficulty(level);
    },

    /**
     * 获取某关卡的通关次数
     * @param {number} level - 关卡 ID
     * @returns {number}
     */
    getClearCount: function (level) {
      return global.Storage.getClearCount(level);
    },

    /**
     * 获取下一关 ID（20→50→100，100 无下一关返回 null）
     * @param {number} level - 当前关卡 ID
     * @returns {number|null}
     */
    getNextLevel: function (level) {
      var ids = Difficulty.LEVELS.map(function (l) { return l.id; });
      var idx = ids.indexOf(level);
      if (idx === -1 || idx >= ids.length - 1) return null;
      return ids[idx + 1];
    },

    /**
     * 获取上一关 ID（100→50→20，20 无上一关返回 null）
     * @param {number} level - 当前关卡 ID
     * @returns {number|null}
     */
    getPreviousLevel: function (level) {
      var ids = Difficulty.LEVELS.map(function (l) { return l.id; });
      var idx = ids.indexOf(level);
      if (idx <= 0) return null;
      return ids[idx - 1];
    }
  };

  global.Difficulty = Difficulty;

})(typeof window !== 'undefined' ? window : this);
