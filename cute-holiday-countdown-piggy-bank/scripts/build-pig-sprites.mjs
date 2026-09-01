import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(ROOT, "scripts", "pig-sources");
const OUTPUT_DIR = path.join(ROOT, "public", "pig");
const CANVAS = 512;
const CELL_WIDTH = 280;
const FRAME_SCALE = 1.48;
const BASELINE_Y = 494;

/**
 * The labels and source mapping are intentionally kept here as the single source
 * of truth for the repeatable asset build.
 */
const ACTIONS = [
  { action: "idle", source: "01.jpg", label: "待机呼吸", fps: 10, rowTops: [260, 660, 1055], rowHeights: [370, 350, 347] },
  { action: "blink", source: "02.jpg", label: "眨眼待机", fps: 12, rowTops: [260, 660, 1055], rowHeights: [370, 350, 347] },
  { action: "ear", source: "03.jpg", label: "耳朵轻颤", fps: 10, rowTops: [260, 660, 1055], rowHeights: [370, 350, 347] },
  { action: "yawn", source: "04.jpg", label: "困倦打哈欠", fps: 10, rowTops: [260, 660, 1055], rowHeights: [370, 350, 347] },
  { action: "look", source: "05.jpg", label: "抬头看时间", fps: 10, rowTops: [260, 660, 1055], rowHeights: [370, 350, 347] },
  { action: "tap", source: "06.jpg", label: "点击回弹", fps: 12, rowTops: [280, 680, 1080], rowHeights: [350, 350, 322] },
  { action: "coin", source: "07.jpg", label: "金币入槽", fps: 12, rowTops: [280, 730, 1110], rowHeights: [350, 315, 292] },
  { action: "off", source: "08.jpg", label: "下班庆祝", fps: 12, rowTops: [260, 685, 1075], rowHeights: [370, 335, 327] },
];

const RAW_BASE = "https://raw.githubusercontent.com/a1335465359-prog/gongzuotaiwanzhengban/main/temporary-image-links";

async function downloadSource(filename) {
  const destination = path.join(SOURCE_DIR, filename);
  if (existsSync(destination) && !process.argv.includes("--refresh")) return destination;

  const response = await fetch(`${RAW_BASE}/${filename}`);
  if (!response.ok) throw new Error(`下载 ${filename} 失败：HTTP ${response.status}`);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
  return destination;
}

function sampleBackground(raw, width, height, channels) {
  const samples = [];
  const size = 12;
  const corners = [
    [0, 0], [width - size, 0], [0, height - size], [width - size, height - size],
  ];
  for (const [left, top] of corners) {
    for (let y = top; y < top + size; y += 1) {
      for (let x = left; x < left + size; x += 1) {
        const i = (y * width + x) * channels;
        samples.push([raw[i], raw[i + 1], raw[i + 2]]);
      }
    }
  }
  const mean = (index) => Math.round(samples.reduce((sum, px) => sum + px[index], 0) / samples.length);
  return [mean(0), mean(1), mean(2)];
}

function chromaKey(raw, width, height, channels, background) {
  const rgba = Buffer.alloc(width * height * 4);
  const mask = new Uint8Array(width * height);

  for (let p = 0; p < width * height; p += 1) {
    const src = p * channels;
    const dst = p * 4;
    const r = raw[src];
    const g = raw[src + 1];
    const b = raw[src + 2];
    const distance = Math.hypot(r - background[0], g - background[1], b - background[2]);
    // JPEG background variance disappears below 10. A generous decontamination
    // ramp is needed because the source JPEG has cyan mixed into edge pixels;
    // the visible feather still resolves to roughly one pixel at runtime size.
    const distanceAlpha = Math.max(0, Math.min(255, ((distance - 10) / 100) * 255));
    const cyanExcess = Math.max(0, Math.min(g - r, b - r));
    const spillFactor = Math.max(0, Math.min(1, 1 - cyanExcess / 28));
    const alpha = Math.round(distanceAlpha * spillFactor);
    mask[p] = alpha;

    if (alpha > 0 && alpha < 255) {
      const a = alpha / 255;
      rgba[dst] = Math.max(0, Math.min(255, Math.round((r - (1 - a) * background[0]) / a)));
      rgba[dst + 1] = Math.max(0, Math.min(255, Math.round((g - (1 - a) * background[1]) / a)));
      rgba[dst + 2] = Math.max(0, Math.min(255, Math.round((b - (1 - a) * background[2]) / a)));
    } else {
      rgba[dst] = r;
      rgba[dst + 1] = g;
      rgba[dst + 2] = b;
    }
    rgba[dst + 3] = alpha;
  }
  return { rgba, mask };
}

function largestComponentBounds(mask, width, height) {
  const seen = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  let best = null;

  for (let start = 0; start < mask.length; start += 1) {
    if (seen[start] || mask[start] < 96) continue;
    let head = 0;
    let tail = 0;
    let count = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    queue[tail++] = start;
    seen[start] = 1;

    while (head < tail) {
      const p = queue[head++];
      const x = p % width;
      const y = Math.floor(p / width);
      count += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      const neighbours = [p - 1, p + 1, p - width, p + width];
      for (const next of neighbours) {
        if (next < 0 || next >= mask.length || seen[next] || mask[next] < 96) continue;
        const nx = next % width;
        if (Math.abs(nx - x) > 1) continue;
        seen[next] = 1;
        queue[tail++] = next;
      }
    }

    if (!best || count > best.count) best = { count, minX, maxX, minY, maxY };
  }
  if (!best) throw new Error("未识别到小猪主体，请检查色键阈值");
  return best;
}

async function buildAction(definition) {
  const sourcePath = await downloadSource(definition.source);
  const source = sharp(await readFile(sourcePath)).removeAlpha();
  const { data: fullRaw, info } = await source.raw().toBuffer({ resolveWithObject: true });
  const background = sampleBackground(fullRaw, info.width, info.height, info.channels);
  const actionDir = path.join(OUTPUT_DIR, definition.action);
  await mkdir(actionDir, { recursive: true });

  const frameReports = [];
  for (let frame = 0; frame < 12; frame += 1) {
    const row = Math.floor(frame / 4);
    const column = frame % 4;
    const left = Math.round(column * (info.width / 4));
    const top = definition.rowTops[row];
    const { data, info: cellInfo } = await sharp(await readFile(sourcePath))
      .extract({ left, top, width: CELL_WIDTH, height: definition.rowHeights[row] })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const keyed = chromaKey(data, cellInfo.width, cellInfo.height, cellInfo.channels, background);
    const subject = largestComponentBounds(keyed.mask, cellInfo.width, cellInfo.height);
    const resizedWidth = Math.round(cellInfo.width * FRAME_SCALE);
    const resizedHeight = Math.round(cellInfo.height * FRAME_SCALE);
    const subjectCenter = ((subject.minX + subject.maxX) / 2) * FRAME_SCALE;
    const subjectBottom = (subject.maxY + 1) * FRAME_SCALE;
    const outputLeft = Math.round(CANVAS / 2 - subjectCenter);
    const outputTop = Math.round(BASELINE_Y - subjectBottom);

    const layer = await sharp(keyed.rgba, {
      raw: { width: cellInfo.width, height: cellInfo.height, channels: 4 },
    }).resize(resizedWidth, resizedHeight, { kernel: sharp.kernel.lanczos3 }).png().toBuffer();

    const filename = `${String(frame + 1).padStart(2, "0")}.webp`;
    const workSize = CANVAS + 512;
    const workOffset = 256;
    const staged = await sharp({
      create: { width: workSize, height: workSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: layer, left: outputLeft + workOffset, top: outputTop + workOffset }])
      .png()
      .toBuffer();
    await sharp(staged)
      .extract({ left: workOffset, top: workOffset, width: CANVAS, height: CANVAS })
      .webp({ quality: 92, alphaQuality: 100, smartSubsample: true })
      .toFile(path.join(actionDir, filename));

    frameReports.push({ frame: frame + 1, crop: { left, top }, anchor: { x: outputLeft, y: outputTop } });
  }

  return {
    action: definition.action,
    source: definition.source,
    label: definition.label,
    frames: 12,
    fps: definition.fps,
    sampledBackground: `rgb(${background.join(", ")})`,
    canvas: `${CANVAS}x${CANVAS}`,
    alignment: `largest-subject center; baseline y=${BASELINE_Y}`,
    frameReports,
  };
}

await mkdir(SOURCE_DIR, { recursive: true });
await mkdir(OUTPUT_DIR, { recursive: true });
const report = [];
for (const action of ACTIONS) report.push(await buildAction(action));
await writeFile(path.join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify({ actions: report }, null, 2)}\n`);
console.log(`完成：${ACTIONS.length} 个动作、${ACTIONS.length * 12} 帧，输出到 ${path.relative(ROOT, OUTPUT_DIR)}`);
