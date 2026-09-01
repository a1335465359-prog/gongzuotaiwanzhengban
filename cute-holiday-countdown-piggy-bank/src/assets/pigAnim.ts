/**
 * Generated-frame runtime manifest.
 *
 * Source mapping (12 frames each, 512×512 transparent WebP):
 * 01 idle · 02 blink · 03 ear · 04 yawn
 * 05 look · 06 tap · 07 coin · 08 off
 *
 * `npm run build:pig` rebuilds every file in public/pig from the eight source
 * JPG sheets. Runtime code never downloads the source sheets or embeds Base64.
 */
export type PigAnimKey = "idle" | "blink" | "ear" | "yawn" | "look" | "tap" | "coin" | "off";

export interface PigAnimationDefinition {
  source: `${string}.jpg`;
  label: string;
  frames: readonly string[];
  fps: number;
  loop: boolean;
}

const frameUrls = (action: PigAnimKey): readonly string[] =>
  Array.from({ length: 12 }, (_, index) => `/pig/${action}/${String(index + 1).padStart(2, "0")}.webp`);

export const PIG_ANIMATIONS: Record<PigAnimKey, PigAnimationDefinition> = {
  idle: { source: "01.jpg", label: "待机呼吸", frames: frameUrls("idle"), fps: 10, loop: true },
  blink: { source: "02.jpg", label: "眨眼待机", frames: frameUrls("blink"), fps: 12, loop: false },
  ear: { source: "03.jpg", label: "耳朵轻颤", frames: frameUrls("ear"), fps: 10, loop: false },
  yawn: { source: "04.jpg", label: "困倦打哈欠", frames: frameUrls("yawn"), fps: 10, loop: false },
  look: { source: "05.jpg", label: "抬头看时间", frames: frameUrls("look"), fps: 10, loop: false },
  tap: { source: "06.jpg", label: "点击回弹", frames: frameUrls("tap"), fps: 12, loop: false },
  coin: { source: "07.jpg", label: "金币入槽", frames: frameUrls("coin"), fps: 12, loop: false },
  off: { source: "08.jpg", label: "下班庆祝", frames: frameUrls("off"), fps: 12, loop: false },
};

export const PIG_ANIM_FRAMES: Record<PigAnimKey, readonly string[]> = Object.fromEntries(
  Object.entries(PIG_ANIMATIONS).map(([key, value]) => [key, value.frames]),
) as Record<PigAnimKey, readonly string[]>;

export const PIG_ANIM_FPS: Record<PigAnimKey, number> = Object.fromEntries(
  Object.entries(PIG_ANIMATIONS).map(([key, value]) => [key, value.fps]),
) as Record<PigAnimKey, number>;

export const PIG_ANIM_META = { width: 512, height: 512 } as const;
