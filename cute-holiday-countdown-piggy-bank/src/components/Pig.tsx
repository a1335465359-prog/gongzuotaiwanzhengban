import { forwardRef, useImperativeHandle, useEffect } from "react";
import { usePigAnimator, type PigAction } from "../lib/usePigAnimator";

export interface PigHandle {
  play: (action: PigAction) => void;
}

interface Props {
  resting?: boolean;
  paused?: boolean;
  onTap?: () => void;
  onLongPress?: () => void;
  /** 触发次数（用于让外部强制看时间等） */
  lookSignal?: number;
  /** 尺寸（宽度 px） */
  size?: number;
}

/**
 * 小猪 —— 场景里的生命体，透明逐帧动画
 *
 * 关键：
 * - 真实 12 帧序列（idle/blink/ear/yawn/look/tap/coin/off）
 * - 透明背景 WebP，无矩形框、无背景、无 mix-blend 黑边
 * - 底部软投影让它"站"在场景里
 * - 低频随机动作，大部分时间安静
 */
const Pig = forwardRef<PigHandle, Props>(({ resting, paused, onTap, onLongPress, lookSignal, size = 180 }, ref) => {
  const { frameUrl, action, frameIdx, trigger } = usePigAnimator({ resting, paused });

  useImperativeHandle(ref, () => ({
    play: (a) => {
      if (a === "sleep") return;
      void trigger(a);
    },
  }));

  // 外部看时间信号
  useEffect(() => {
    if (lookSignal && !paused && !resting) {
      void trigger("look");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookSignal]);

  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  const startLongPress = () => {
    if (!onLongPress) return;
    longPressTimer = setTimeout(() => {
      onLongPress();
      longPressTimer = null;
    }, 800);
  };
  const cancelLongPress = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const handleTap = () => {
    void trigger("tap");
    onTap?.();
  };

  // 让呼吸有轻微上下浮动（仅 idle 时）
  const isIdle = action === "idle";

  return (
    <div
      className="relative select-none"
      style={{ width: size, height: size }}
      onPointerDown={startLongPress}
      onPointerUp={() => {
        if (longPressTimer) {
          cancelLongPress();
          handleTap();
        }
      }}
      onPointerLeave={cancelLongPress}
      onPointerCancel={cancelLongPress}
      role="button"
      aria-label="小猪"
    >
      {/* 地面软阴影 */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: size * 0.02,
          width: size * 0.56,
          height: size * 0.05,
          background: "radial-gradient(ellipse at center, rgba(41,39,37,.16) 0%, transparent 70%)",
          filter: "blur(3px)",
        }}
      />
      {/* 小猪本体（透明帧） */}
      <img
        key={frameIdx}
        src={frameUrl}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        style={{
          transform: isIdle ? undefined : "none",
          transition: "transform 0.3s",
        }}
      />
    </div>
  );
});

Pig.displayName = "Pig";
export default Pig;
