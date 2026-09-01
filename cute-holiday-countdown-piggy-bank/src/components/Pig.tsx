import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { usePigAnimator, type PigAction } from "../lib/usePigAnimator";

export interface PigHandle {
  play: (action: PigAction) => Promise<boolean>;
}

interface Props {
  resting?: boolean;
  paused?: boolean;
  onTap?: () => void;
  onLongPress?: () => void;
  lookSignal?: number;
  size?: number;
}

const Pig = forwardRef<PigHandle, Props>(({
  resting,
  paused,
  onTap,
  onLongPress,
  lookSignal,
  size = 180,
}, ref) => {
  const { frameUrl, action, trigger } = usePigAnimator({ resting, paused });
  const longPressTimer = useRef<number | null>(null);
  const tapLocked = useRef(false);

  useImperativeHandle(ref, () => ({ play: trigger }), [trigger]);

  useEffect(() => {
    if (lookSignal && !paused && !resting) void trigger("look");
  }, [lookSignal, paused, resting, trigger]);

  useEffect(() => () => {
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
  }, []);

  const cancelLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startLongPress = () => {
    if (!onLongPress || tapLocked.current) return;
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      onLongPress();
    }, 800);
  };

  const handleTap = async () => {
    if (tapLocked.current) return;
    tapLocked.current = true;
    const played = await trigger("tap");
    if (played) {
      onTap?.();
      await trigger("coin");
    }
    tapLocked.current = false;
  };

  return (
    <div
      className="relative select-none touch-manipulation"
      style={{ width: size, height: size }}
      onPointerDown={startLongPress}
      onPointerUp={() => {
        if (longPressTimer.current !== null) {
          cancelLongPress();
          void handleTap();
        }
      }}
      onPointerLeave={cancelLongPress}
      onPointerCancel={cancelLongPress}
      role="button"
      aria-label={action === "tap" || action === "coin" ? "小猪正在收金币" : "点击小猪"}
      aria-disabled={paused || tapLocked.current}
    >
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: size * 0.018,
          width: size * 0.52,
          height: size * 0.045,
          background: "radial-gradient(ellipse at center, rgba(41,39,37,.15) 0%, transparent 70%)",
          filter: "blur(3px)",
        }}
      />
      <img
        src={frameUrl}
        alt=""
        draggable={false}
        decoding="async"
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />
    </div>
  );
});

Pig.displayName = "Pig";
export default Pig;
