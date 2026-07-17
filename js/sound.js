/**
 * sound.js - Web Audio API 声音合成模块
 * 儿童数学闯关游戏 - 程序化生成音效（无外部音频文件）
 *
 * 通过全局对象 Sound 暴露接口（window.Sound）
 *
 * 音效类型：
 *   'correct' - 答对：C-E-G 上行琶音，清脆鼓励，约 200ms
 *   'wrong'   - 答错：温和下行两音，低音量柔和，约 300ms（鼓励而非惩罚）
 *   'click'   - 点击：极短"嗒"声，约 50ms
 *   'victory' - 胜利：上行大调音阶 + 三和弦，约 1.2s
 *   'unlock'  - 解锁：明亮上行音阶带延迟，约 500ms
 *   'badge'   - 徽章：高音"叮" + 闪烁，约 400ms
 *
 * 实现要点：
 *   - 使用 OscillatorNode + GainNode 合成
 *   - 每个音符带 ADSR 简化包络（attack/release）实现平滑过渡
 *   - 音量控制在 0.1-0.3 之间，保护儿童听力
 *   - 处理浏览器自动播放策略：init() 恢复挂起的 AudioContext
 */

(function (global) {
  'use strict';

  var Sound = {
    _ctx: null,        // AudioContext 实例
    _enabled: true,    // 是否启用声音（从 localStorage 读取初始值）
    _masterGain: null, // 主音量控制节点（所有声音经此输出）

    /**
     * 初始化 AudioContext（必须在用户交互后调用，否则浏览器会挂起）
     */
    init: function () {
      // 首次初始化时从 localStorage 读取音效开关状态
      if (Sound._enabled === true && !Sound._ctx) {
        try {
          var saved = localStorage.getItem('mathWorld_soundEnabled');
          if (saved === 'false') Sound._enabled = false;
        } catch (e) { /* 忽略 */ }
      }
      if (Sound._ctx) {
        // 已创建过：若被浏览器挂起则恢复
        if (Sound._ctx.state === 'suspended') {
          Sound._ctx.resume();
        }
        return;
      }
      var AudioContextClass = global.AudioContext || global.webkitAudioContext;
      if (!AudioContextClass) {
        return; // 浏览器不支持 Web Audio API
      }
      Sound._ctx = new AudioContextClass();
      Sound._masterGain = Sound._ctx.createGain();
      Sound._masterGain.gain.value = 1.0;
      Sound._masterGain.connect(Sound._ctx.destination);
      if (Sound._ctx.state === 'suspended') {
        Sound._ctx.resume();
      }
    },

    /**
     * 启用/禁用声音（同步持久化到 localStorage）
     * @param {boolean} bool
     */
    setEnabled: function (bool) {
      Sound._enabled = !!bool;
      try {
        localStorage.setItem('mathWorld_soundEnabled', String(Sound._enabled));
      } catch (e) { /* 忽略 */ }
    },

    /**
     * 查询声音是否启用
     * @returns {boolean}
     */
    isEnabled: function () {
      return Sound._enabled;
    },

    /**
     * 播放音效
     * @param {string} type - 音效类型
     */
    play: function (type) {
      if (!Sound._enabled) return;
      // 若未初始化则尝试初始化（需在用户交互上下文中调用）
      if (!Sound._ctx) {
        Sound.init();
      }
      if (!Sound._ctx) return;
      // 浏览器自动播放策略：每次播放前确保上下文处于运行状态
      if (Sound._ctx.state === 'suspended') {
        Sound._ctx.resume();
      }
      switch (type) {
        case 'correct':  Sound._playCorrect();  break;
        case 'wrong':    Sound._playWrong();    break;
        case 'click':    Sound._playClick();    break;
        case 'victory':  Sound._playVictory();  break;
        case 'unlock':   Sound._playUnlock();   break;
        case 'badge':    Sound._playBadge();    break;
        default: break;
      }
    },

    /**
     * 创建并播放一个带包络的振荡器音符
     * @param {number} freq - 频率（Hz）
     * @param {number} startTime - 起始时间（AudioContext.currentTime 相对值）
     * @param {number} duration - 时长（秒）
     * @param {number} peakGain - 峰值音量（0-1）
     * @param {string} oscType - 振荡器类型 'sine'|'triangle'|'square'|'sawtooth'
     * @private
     */
    _playNote: function (freq, startTime, duration, peakGain, oscType) {
      var ctx = Sound._ctx;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = oscType || 'sine';
      osc.frequency.value = freq;

      // 简化 ADSR 包络：快速 attack → 指数 release，避免"咔哒"爆音
      var attack = 0.012;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(Sound._masterGain);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    },

    /**
     * 'correct' 答对音效：C5-E5-G5 上行琶音（正弦波），清脆鼓励
     * 总时长约 200ms
     */
    _playCorrect: function () {
      var ctx = Sound._ctx;
      var t0 = ctx.currentTime;
      // C5=523.25, E5=659.25, G5=783.99
      var notes = [523.25, 659.25, 783.99];
      var noteDur = 0.07;
      for (var i = 0; i < notes.length; i++) {
        Sound._playNote(notes[i], t0 + i * noteDur, noteDur + 0.05, 0.22, 'sine');
      }
    },

    /**
     * 'wrong' 答错音效：E5→C5 下行两音，低音量、柔和正弦波
     * 总时长约 300ms，鼓励而非惩罚
     */
    _playWrong: function () {
      var ctx = Sound._ctx;
      var t0 = ctx.currentTime;
      // E5=659.25 -> C5=523.25
      Sound._playNote(659.25, t0, 0.15, 0.12, 'sine');
      Sound._playNote(523.25, t0 + 0.15, 0.2, 0.12, 'sine');
    },

    /**
     * 'click' 点击音效：极短的"嗒"声（A5 正弦波）
     * 总时长约 50ms，低音量
     */
    _playClick: function () {
      var ctx = Sound._ctx;
      var t0 = ctx.currentTime;
      Sound._playNote(880, t0, 0.05, 0.15, 'sine');
    },

    /**
     * 'victory' 胜利音效：C 大调上行音阶 + 末尾三和弦（多振荡器）
     * 总时长约 1.2 秒
     */
    _playVictory: function () {
      var ctx = Sound._ctx;
      var t0 = ctx.currentTime;
      // C 大调音阶 C5 D5 E5 F5 G5 A5 B5
      var scale = [523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77];
      var step = 0.09;
      for (var i = 0; i < scale.length; i++) {
        Sound._playNote(scale[i], t0 + i * step, step + 0.08, 0.18, 'triangle');
      }
      // 末尾三和弦 C5+E5+G5 同时奏响（多振荡器叠加，营造庆祝感）
      var chordStart = t0 + scale.length * step + 0.02;
      var chordDur = 0.5;
      Sound._playNote(523.25, chordStart, chordDur, 0.16, 'sine');
      Sound._playNote(659.25, chordStart, chordDur, 0.16, 'sine');
      Sound._playNote(783.99, chordStart, chordDur, 0.16, 'sine');
    },

    /**
     * 'unlock' 解锁音效：C5-E5-G5-C6 明亮上行音阶，音符间有轻微延迟
     * 总时长约 500ms
     */
    _playUnlock: function () {
      var ctx = Sound._ctx;
      var t0 = ctx.currentTime;
      // C5 E5 G5 C6 上行
      var notes = [523.25, 659.25, 783.99, 1046.50];
      var step = 0.11;
      for (var i = 0; i < notes.length; i++) {
        Sound._playNote(notes[i], t0 + i * step, step + 0.1, 0.2, 'triangle');
      }
    },

    /**
     * 'badge' 徽章音效：清脆高音"叮" + 闪烁感尾音
     * 总时长约 400ms
     */
    _playBadge: function () {
      var ctx = Sound._ctx;
      var t0 = ctx.currentTime;
      // 高音"叮"
      Sound._playNote(1318.51, t0, 0.18, 0.2, 'sine');        // E6
      // 闪烁感：两个更高更短促的尾音
      Sound._playNote(1567.98, t0 + 0.12, 0.12, 0.14, 'sine'); // G6
      Sound._playNote(2093.00, t0 + 0.22, 0.18, 0.12, 'triangle'); // C7
    }
  };

  global.Sound = Sound;

})(typeof window !== 'undefined' ? window : this);
