/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, RotateCcw, Trophy, Hand, Calculator, ChevronRight, Volume2, VolumeX } from 'lucide-react';
import confetti from 'canvas-confetti';

// --- Sound Synthesis ---
class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private getCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  setMute(mute: boolean) {
    this.isMuted = mute;
  }

  playGrab() {
    if (this.isMuted) return;
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  playScatter() {
    if (this.isMuted) return;
    const ctx = this.getCtx();
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800 + Math.random() * 400, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      }, i * 50);
    }
  }

  playCount(index: number) {
    if (this.isMuted) return;
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    // Ascending pitch based on count
    const freq = 400 + (index % 20) * 20;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.2, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  playResult(isPerfect: boolean) {
    if (this.isMuted) return;
    const ctx = this.getCtx();
    const notes = isPerfect ? [523.25, 659.25, 783.99, 1046.50] : [392.00, 523.25, 659.25];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + i * 0.1 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.3);
    });
  }
}

const soundManager = new SoundManager();

// --- Types ---
type GameState = 'START' | 'NAME_INPUT' | 'POOL' | 'GRABBING' | 'GRAB' | 'ESTIMATE' | 'COUNT' | 'RESULT' | 'LEADERBOARD';

interface BeanData {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  expression: 'happy' | 'wink' | 'surprised' | 'cute';
  isInHandful?: boolean;
  isGrabbing?: boolean;
}

// --- Constants ---
const BEAN_COLORS = [
  '#FFD93D', // Yellow
  '#FF8B13', // Orange
  '#6BCB77', // Green
  '#4D96FF', // Blue
  '#FF6B6B', // Red
];

const EXPRESSIONS = ['happy', 'wink', 'surprised', 'cute'] as const;

// --- Components ---

const BeanFace = ({ type }: { type: BeanData['expression'] }) => {
  switch (type) {
    case 'happy':
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full">
          <circle cx="15" cy="15" r="2" fill="black" />
          <circle cx="25" cy="15" r="2" fill="black" />
          <path d="M 12 25 Q 20 32 28 25" stroke="black" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      );
    case 'wink':
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full">
          <path d="M 12 15 L 18 15" stroke="black" strokeWidth="2" strokeLinecap="round" />
          <circle cx="25" cy="15" r="2" fill="black" />
          <path d="M 12 25 Q 20 32 28 25" stroke="black" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      );
    case 'surprised':
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full">
          <circle cx="15" cy="15" r="2" fill="black" />
          <circle cx="25" cy="15" r="2" fill="black" />
          <circle cx="20" cy="28" r="4" stroke="black" strokeWidth="2" fill="none" />
        </svg>
      );
    case 'cute':
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full">
          <circle cx="15" cy="15" r="2" fill="black" />
          <circle cx="25" cy="15" r="2" fill="black" />
          <path d="M 15 25 Q 20 20 25 25" stroke="black" strokeWidth="2" fill="none" strokeLinecap="round" />
          <circle cx="10" cy="20" r="3" fill="#FFB7B7" opacity="0.6" />
          <circle cx="30" cy="20" r="3" fill="#FFB7B7" opacity="0.6" />
        </svg>
      );
  }
};

interface BeanProps {
  data: BeanData;
  isCounted: boolean;
  onClick?: () => void;
  index?: number;
  key?: React.Key;
  isScattering?: boolean;
}

const Bean = ({ data, isCounted, onClick, index, isScattering }: BeanProps) => {
  const scatterDelay = useMemo(() => Math.random() * 0.5, []);

  return (
    <motion.div
      layoutId={`bean-${data.id}`}
      initial={isScattering ? { y: -400, x: 0, opacity: 0, scale: 0.5, rotate: 0 } : { scale: 0, opacity: 0 }}
      animate={{ 
        scale: 1, 
        opacity: 1,
        x: isCounted ? 0 : data.x,
        y: isCounted ? 0 : data.y,
        rotate: data.rotation
      }}
      transition={isScattering ? { 
        type: "spring", 
        damping: 12, 
        stiffness: 100,
        delay: scatterDelay // Stable staggered drop
      } : { duration: 0.3 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={`absolute cursor-pointer select-none flex items-center justify-center`}
      style={{
        width: '40px',
        height: '50px',
        backgroundColor: data.color,
        borderRadius: '40% 40% 45% 45%',
        boxShadow: 'inset -4px -4px 0px rgba(0,0,0,0.1), 2px 2px 8px rgba(0,0,0,0.1)',
        zIndex: isCounted ? 10 : 1,
        position: isCounted ? 'relative' : 'absolute',
      }}
    >
      <div className="w-8 h-8">
        <BeanFace type={data.expression} />
      </div>
    </motion.div>
  );
};

interface LeaderboardEntry {
  name: string;
  actual: number;
  estimate: number;
  diff: number;
  date: string;
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('START');
  const [playerName, setPlayerName] = useState<string>('');
  const [beans, setBeans] = useState<BeanData[]>([]);
  const [countedBeans, setCountedBeans] = useState<BeanData[]>([]);
  const [estimate, setEstimate] = useState<string>('');
  const [actualCount, setActualCount] = useState<number>(0);
  const [message, setMessage] = useState<string>('');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('bean-leaderboard');
    if (saved) {
      try {
        setLeaderboard(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load leaderboard", e);
      }
    }
  }, []);

  useEffect(() => {
    soundManager.setMute(isMuted);
  }, [isMuted]);

  const generateBeans = useCallback(() => {
    const count = 100; // Always 100 beans in the pool
    const newBeans: BeanData[] = [];
    for (let i = 0; i < count; i++) {
      newBeans.push({
        id: i,
        // Initial pool position: in a "jar" shape (taller than wide)
        x: Math.random() * 160 - 80,
        y: Math.random() * 240 - 120,
        rotation: Math.random() * 360,
        color: BEAN_COLORS[Math.floor(Math.random() * BEAN_COLORS.length)],
        expression: EXPRESSIONS[Math.floor(Math.random() * EXPRESSIONS.length)],
        isInHandful: false,
      });
    }
    setBeans(newBeans);
    setActualCount(0);
    setCountedBeans([]);
    setEstimate('');
  }, []);

  const handleStart = () => {
    setGameState('NAME_INPUT');
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim()) {
      setGameState('POOL');
      generateBeans();
    }
  };

  const handleGrab = () => {
    setGameState('GRABBING');
    soundManager.playGrab();
    
    const handfulCount = Math.floor(Math.random() * 80) + 20; // 20 to 100 beans
    const indices = Array.from({ length: 100 }, (_, i) => i);
    const shuffled = indices.sort(() => 0.5 - Math.random());
    const selectedIndices = new Set(shuffled.slice(0, handfulCount));

    // First, mark which beans are being grabbed
    setBeans(prev => prev.map(bean => ({
      ...bean,
      isGrabbing: selectedIndices.has(bean.id)
    })));

    // After animation, scatter them
    setTimeout(() => {
      soundManager.playScatter();
      setBeans(prev => prev.map(bean => {
        if (selectedIndices.has(bean.id)) {
          return {
            ...bean,
            isInHandful: true,
            isGrabbing: false,
            // Scattered position for handful
            x: Math.random() * 320 - 160,
            y: Math.random() * 320 - 160,
          };
        }
        return { ...bean, isGrabbing: false };
      }));
      setActualCount(handfulCount);
      setGameState('GRAB');
    }, 1200);
  };

  const handleEstimateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (estimate && !isNaN(Number(estimate))) {
      setGameState('COUNT');
    }
  };

  const handleBeanClick = (bean: BeanData) => {
    if (gameState !== 'COUNT') return;
    if (countedBeans.find(b => b.id === bean.id)) return;

    soundManager.playCount(countedBeans.length);
    setCountedBeans(prev => [...prev, bean]);
    
    if (countedBeans.length + 1 === actualCount) {
      setTimeout(() => {
        setGameState('RESULT');
        calculateResult();
      }, 500);
    }
  };

  const calculateResult = () => {
    const est = Number(estimate);
    const diff = Math.abs(est - actualCount);
    
    soundManager.playResult(diff <= 5);

    // Save to leaderboard
    const newEntry: LeaderboardEntry = {
      name: playerName,
      actual: actualCount,
      estimate: est,
      diff: diff,
      date: new Date().toLocaleDateString()
    };
    const updatedLeaderboard = [newEntry, ...leaderboard]
      .sort((a, b) => a.diff - b.diff || b.actual - a.actual)
      .slice(0, 10);
    setLeaderboard(updatedLeaderboard);
    localStorage.setItem('bean-leaderboard', JSON.stringify(updatedLeaderboard));

    if (diff === 0) {
      setMessage('天哪！你简直是数学小天才！估得一模一样！🌟');
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    } else if (diff <= 5) {
      setMessage('太棒了！你的眼力非常好，非常接近哦！👏');
      confetti({ particleCount: 100, spread: 60, origin: { y: 0.6 } });
    } else if (diff <= 15) {
      setMessage('不错哦！再多练习几次，你会估得更准的！😊');
    } else {
      setMessage('没关系，数一数才知道准确的数量。继续加油！💪');
    }
  };

  const resetGame = () => {
    setGameState('START');
    setBeans([]);
    setCountedBeans([]);
    setEstimate('');
  };

  return (
    <div className="min-h-screen bg-[#FFF9F0] font-sans text-gray-800 p-4 md:p-8 flex flex-col items-center">
      {/* Header */}
      <header className="w-full max-w-2xl flex justify-between items-center mb-8">
        <div className="flex items-center gap-2">
          <div className="bg-yellow-400 p-2 rounded-xl shadow-sm">
            <Calculator className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-yellow-700 tracking-tight">数豆子大冒险</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-full hover:bg-yellow-100 text-yellow-600 transition-colors"
            title={isMuted ? "开启声音" : "关闭声音"}
          >
            {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </button>
          {gameState !== 'START' && (
            <button 
              onClick={resetGame}
              className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              重新开始
            </button>
          )}
        </div>
      </header>

      <main className="w-full max-w-4xl flex flex-col items-center justify-center flex-1 relative">
        <AnimatePresence mode="wait">
          {/* Start Screen */}
          {gameState === 'START' && (
            <motion.div
              key="start"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center space-y-8"
            >
              <div className="relative">
                <motion.div 
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 4 }}
                  className="w-48 h-48 bg-yellow-100 rounded-full flex items-center justify-center mx-auto"
                >
                   <div className="grid grid-cols-3 gap-2">
                      {[1,2,3,4,5,6].map(i => (
                        <div key={i} className="w-8 h-10 rounded-full" style={{ backgroundColor: BEAN_COLORS[i % BEAN_COLORS.length] }} />
                      ))}
                   </div>
                </motion.div>
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5 }}
                  className="absolute -bottom-4 -right-4 bg-white p-3 rounded-2xl shadow-lg border-2 border-yellow-200"
                >
                  <Sparkles className="text-yellow-500 w-8 h-8" />
                </motion.div>
              </div>
              
              <div className="space-y-4">
                <h2 className="text-4xl font-black text-gray-900">准备好数豆子了吗？</h2>
                <p className="text-lg text-gray-600 max-w-md mx-auto">
                  先抓一把豆子，猜猜有多少，然后再一个一个数清楚。看看你的眼力准不准！
                </p>
              </div>

              <div className="flex flex-col gap-4 items-center">
                <button
                  onClick={handleStart}
                  className="group relative px-12 py-5 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold text-xl rounded-3xl shadow-[0_8px_0_rgb(202,138,4)] active:shadow-none active:translate-y-2 transition-all"
                >
                  开始游戏
                </button>
                {leaderboard.length > 0 && (
                  <button
                    onClick={() => setGameState('LEADERBOARD')}
                    className="text-yellow-600 font-bold hover:underline"
                  >
                    查看排行榜 🏆
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Name Input Screen */}
          {gameState === 'NAME_INPUT' && (
            <motion.div
              key="name-input"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="text-center space-y-8 bg-white p-10 rounded-[3rem] shadow-xl border-4 border-yellow-100"
            >
              <div className="space-y-4">
                <h2 className="text-3xl font-black text-gray-900">你是哪位数学小天才？</h2>
                <p className="text-gray-500">输入你的名字，记录你的好成绩！</p>
              </div>
              <form onSubmit={handleNameSubmit} className="flex flex-col gap-6">
                <input
                  autoFocus
                  type="text"
                  maxLength={10}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="输入你的大名"
                  className="w-full text-center text-2xl font-bold p-4 rounded-2xl border-4 border-yellow-400 focus:outline-none focus:ring-4 ring-yellow-200 transition-all"
                />
                <button
                  type="submit"
                  disabled={!playerName.trim()}
                  className="px-10 py-4 bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-200 text-yellow-900 font-bold text-xl rounded-2xl shadow-lg transition-all"
                >
                  准备好了！
                </button>
              </form>
            </motion.div>
          )}

          {/* Pool Screen (100 Beans) */}
          {gameState === 'POOL' && (
            <motion.div
              key="pool"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full flex flex-col items-center gap-8"
            >
              <div className="relative w-full max-w-md aspect-[3/4] bg-white/60 rounded-[3rem] border-8 border-yellow-100 flex items-center justify-center overflow-hidden shadow-inner">
                {/* Jar Top */}
                <div className="absolute top-0 w-full h-8 bg-yellow-200/50" />
                
                <div className="relative w-full h-full flex items-center justify-center">
                  {beans.map((bean) => (
                    <Bean key={bean.id} data={bean} isCounted={false} />
                  ))}
                </div>
                
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/80 px-4 py-1 rounded-full text-sm font-bold text-yellow-600 shadow-sm">
                  这里有 100 颗豆子
                </div>
              </div>

              <button
                onClick={handleGrab}
                className="group relative px-10 py-4 bg-orange-400 hover:bg-orange-500 text-white font-bold text-xl rounded-2xl shadow-[0_6px_0_rgb(194,65,12)] active:shadow-none active:translate-y-1 transition-all flex items-center gap-3"
              >
                <Hand className="w-6 h-6" />
                抓一把！
              </button>
            </motion.div>
          )}

          {/* Grabbing Animation Screen */}
          {gameState === 'GRABBING' && (
            <motion.div
              key="grabbing"
              className="w-full flex flex-col items-center gap-8"
            >
              <div className="relative w-full max-w-md aspect-[3/4] bg-white/60 rounded-[3rem] border-8 border-yellow-100 flex items-center justify-center overflow-hidden shadow-inner">
                <div className="relative w-full h-full flex items-center justify-center">
                  {beans.map((bean) => (
                    <Bean 
                      key={bean.id} 
                      data={bean} 
                      isCounted={false} 
                      // Animate beans being "lifted"
                      {...(bean.isGrabbing ? {
                        animate: { y: -200, opacity: 0, scale: 1.2 },
                        transition: { duration: 0.8, delay: 0.2 }
                      } : {})}
                    />
                  ))}
                </div>
                
                {/* Grabbing Hand Animation */}
                <motion.div
                  initial={{ y: 400, x: 0 }}
                  animate={{ y: [400, 100, 100, 400] }}
                  transition={{ duration: 1.2, times: [0, 0.4, 0.6, 1] }}
                  className="absolute z-50 text-orange-500"
                >
                  <Hand className="w-32 h-32 fill-orange-100" />
                </motion.div>
              </div>
              <h2 className="text-2xl font-bold text-orange-600 animate-pulse">正在抓豆子...</h2>
            </motion.div>
          )}

          {/* Grab & Estimate Screen */}
          {(gameState === 'GRAB' || gameState === 'ESTIMATE') && (
            <motion.div
              key="grab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex flex-col items-center gap-8"
            >
              <div className="relative w-full max-w-lg aspect-square bg-white/50 rounded-[4rem] border-4 border-dashed border-yellow-200 flex items-center justify-center overflow-hidden">
                <div className="relative w-full h-full flex items-center justify-center">
                  {beans.filter(b => b.isInHandful).map((bean) => (
                    <Bean 
                      key={bean.id} 
                      data={bean} 
                      isCounted={false} 
                      isScattering={true}
                    />
                  ))}
                </div>
              </div>
              
              <div className="w-full flex flex-col items-center gap-6">
                {gameState === 'GRAB' && (
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <p className="text-xl font-medium text-gray-600 italic">抓好了！豆子已经散开啦~</p>
                    <button
                      onClick={() => setGameState('ESTIMATE')}
                      className="bg-white px-10 py-5 rounded-3xl shadow-xl border-2 border-yellow-400 flex items-center gap-3 text-2xl font-bold text-yellow-700 hover:scale-105 active:scale-95 transition-all"
                    >
                      <Sparkles className="w-8 h-8 text-yellow-500" />
                      猜猜有多少？
                    </button>
                  </motion.div>
                )}

                {gameState === 'ESTIMATE' && (
                  <motion.form
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    onSubmit={handleEstimateSubmit}
                    className="flex flex-col items-center gap-6"
                  >
                    <label className="text-2xl font-bold text-gray-700">我估计这里有：</label>
                    <div className="flex gap-4">
                      <input
                        autoFocus
                        type="number"
                        value={estimate}
                        onChange={(e) => setEstimate(e.target.value)}
                        placeholder="输入数字"
                        className="w-40 text-center text-3xl font-black p-4 rounded-2xl border-4 border-yellow-400 focus:outline-none focus:ring-4 ring-yellow-200 transition-all"
                      />
                      <button
                        type="submit"
                        disabled={!estimate}
                        className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white p-4 rounded-2xl shadow-lg transition-all"
                      >
                        <ChevronRight className="w-8 h-8" />
                      </button>
                    </div>
                  </motion.form>
                )}
              </div>
            </motion.div>
          )}

          {/* Count Screen */}
          {gameState === 'COUNT' && (
            <motion.div
              key="count"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-start"
            >
              {/* Pile of Beans */}
              <div className="flex flex-col items-center gap-4">
                <h3 className="text-xl font-bold text-gray-500">点击豆子开始数数</h3>
                <div className="relative w-full aspect-square bg-white/40 rounded-[3rem] border-2 border-yellow-100 flex items-center justify-center">
                  {beans.filter(b => b.isInHandful && !countedBeans.find(cb => cb.id === b.id)).map((bean) => (
                    <Bean 
                      key={bean.id} 
                      data={bean} 
                      isCounted={false} 
                      onClick={() => handleBeanClick(bean)} 
                    />
                  ))}
                  {actualCount === countedBeans.length && (
                    <div className="text-green-500 font-bold text-xl">数完啦！</div>
                  )}
                </div>
              </div>

              {/* Counting Area */}
              <div className="flex flex-col items-center gap-4">
                <div className="flex justify-between w-full px-4">
                  <h3 className="text-xl font-bold text-blue-600">
                    {countedBeans.length === actualCount 
                      ? `数完啦！一共：${countedBeans.length} 个` 
                      : `正在数豆子...`}
                  </h3>
                  <h3 className="text-xl font-bold text-gray-400">我的估计：{estimate}</h3>
                </div>
                <div className="w-full min-h-[400px] bg-white rounded-[3rem] shadow-inner border-4 border-blue-50 p-6 flex flex-wrap content-start gap-3 overflow-y-auto max-h-[600px]">
                  {countedBeans.map((bean, idx) => (
                    <Bean 
                      key={`counted-${bean.id}`} 
                      data={bean} 
                      isCounted={true} 
                      index={idx}
                    />
                  ))}
                  {countedBeans.length === 0 && (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 italic">
                      豆子会跳到这里来...
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Result Screen */}
          {gameState === 'RESULT' && (
            <motion.div
              key="result"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center space-y-8 bg-white p-12 rounded-[4rem] shadow-2xl border-8 border-yellow-100 max-w-2xl"
            >
              <div className="flex justify-center gap-4 mb-4">
                <motion.div 
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="bg-yellow-100 p-4 rounded-full"
                >
                  <Trophy className="w-12 h-12 text-yellow-500" />
                </motion.div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-yellow-600">{playerName}，太棒了！</h3>
                <h2 className="text-5xl font-black text-gray-900">{actualCount} 颗豆子!</h2>
                <p className="text-2xl text-gray-500 font-medium">你估计的是 {estimate}</p>
              </div>

              <div className="bg-yellow-50 p-8 rounded-3xl border-2 border-yellow-100">
                <p className="text-2xl font-bold text-yellow-800 leading-relaxed">
                  {message}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => {
                    setGameState('POOL');
                    generateBeans();
                  }}
                  className="px-8 py-4 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold text-lg rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  再玩一次
                </button>
                <button
                  onClick={() => setGameState('LEADERBOARD')}
                  className="px-8 py-4 bg-orange-100 hover:bg-orange-200 text-orange-600 font-bold text-lg rounded-2xl transition-all"
                >
                  查看排行榜
                </button>
                <button
                  onClick={resetGame}
                  className="px-8 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-lg rounded-2xl transition-all"
                >
                  回主界面
                </button>
              </div>
            </motion.div>
          )}

          {/* Leaderboard Screen */}
          {gameState === 'LEADERBOARD' && (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-2xl bg-white p-8 rounded-[3rem] shadow-2xl border-8 border-yellow-100"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-black text-gray-900 flex items-center justify-center gap-3">
                  <Trophy className="text-yellow-500 w-8 h-8" />
                  数学小天才排行榜
                </h2>
                <p className="text-gray-500 mt-2">谁的眼力最准呢？（差值越小排名越高）</p>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {leaderboard.map((entry, idx) => (
                  <div 
                    key={idx}
                    className={`flex items-center justify-between p-4 rounded-2xl border-2 ${idx === 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-100'}`}
                  >
                    <div className="flex items-center gap-4">
                      <span className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${idx === 0 ? 'bg-yellow-400 text-white' : 'bg-gray-200 text-gray-500'}`}>
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-bold text-lg">{entry.name}</p>
                        <p className="text-xs text-gray-400">{entry.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-yellow-600">差值: {entry.diff}</p>
                      <p className="text-xs text-gray-500">估 {entry.estimate} / 实 {entry.actual}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setGameState('START')}
                className="w-full mt-8 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-lg rounded-2xl transition-all"
              >
                返回
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Decoration */}
      <footer className="mt-12 text-gray-400 text-sm flex items-center gap-2">
        <span>数学很有趣，豆子也爱你</span>
        <div className="flex gap-1">
          {BEAN_COLORS.map(c => <div key={c} className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />)}
        </div>
      </footer>
    </div>
  );
}
