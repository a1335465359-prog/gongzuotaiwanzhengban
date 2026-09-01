// 验证三种首页状态逻辑
import { useClock } from './src/lib/useClock.ts'; // not directly callable; instead reason about it
import { DEFAULT_SETTINGS, Settings } from './src/lib/store.ts';

// Since useClock is a React hook, replicate its core buildClock logic by importing time utils
