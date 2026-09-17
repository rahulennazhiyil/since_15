import type { Ctx } from './types';

export const DATE_STAMP_COLOR = '#ffb457';

/** Classic compact-camera style: '26 09 15 */
export function formatDateStamp(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `'${String(date.getFullYear()).slice(-2)} ${p(date.getMonth() + 1)} ${p(date.getDate())}`;
}

export function drawDateStamp(ctx: Ctx, width: number, height: number, date = new Date()): void {
  const size = Math.round(Math.min(width, height) * 0.055);
  const pad = Math.round(size * 0.9);
  ctx.save();
  ctx.font = `600 ${size}px "Manrope Variable", "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = DATE_STAMP_COLOR;
  ctx.shadowColor = 'rgba(255, 140, 40, 0.75)';
  ctx.shadowBlur = size * 0.35;
  ctx.fillText(formatDateStamp(date), width - pad, height - pad);
  ctx.restore();
}
