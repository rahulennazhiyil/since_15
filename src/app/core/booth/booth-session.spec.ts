import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { PhotoComposer } from '../photo/photo-composer';
import { BoothSession, type FrameGrab } from './booth-session';

const fakeBitmap = () => ({ width: 1280, height: 720, close: vi.fn() }) as unknown as ImageBitmap;

describe('BoothSession', () => {
  let session: BoothSession;
  let compose: Mock<PhotoComposer['compose']>;
  let grab: Mock<FrameGrab>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:fake'),
      revokeObjectURL: vi.fn(),
    });
    compose = vi.fn(async () => ({ blob: new Blob(['x'], { type: 'image/jpeg' }), width: 10, height: 10 }));
    grab = vi.fn(async () => fakeBitmap());
    TestBed.configureTestingModule({
      providers: [BoothSession, { provide: PhotoComposer, useValue: { compose } }],
    });
    session = TestBed.inject(BoothSession);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts idle in single mode with a 3 second countdown', () => {
    expect(session.phase()).toBe('idle');
    expect(session.mode()).toBe('single');
    expect(session.countdown()).toBe(3);
  });

  it('counts down, flashes, grabs one frame and reaches review', async () => {
    const ticks: number[] = [];
    session.onTick = () => ticks.push(session.countdownValue() ?? -1);
    const run = session.capture(grab);

    expect(session.phase()).toBe('countdown');
    expect(session.countdownValue()).toBe(3);
    await vi.advanceTimersByTimeAsync(1000);
    expect(session.countdownValue()).toBe(2);
    await vi.advanceTimersByTimeAsync(2000);
    await run;

    expect(ticks).toEqual([3, 2, 1]);
    expect(grab).toHaveBeenCalledTimes(1);
    expect(session.flashToken()).toBe(1);
    expect(compose).toHaveBeenCalledWith(expect.objectContaining({ layoutId: 'single' }));
    expect(session.phase()).toBe('review');
    expect(session.photo()?.url).toBe('blob:fake');
  });

  it('skips the countdown when set to 0', async () => {
    session.setCountdown(0);
    await session.capture(grab);
    expect(grab).toHaveBeenCalledTimes(1);
    expect(session.phase()).toBe('review');
  });

  it('takes three shots with a 3s gap in strip mode', async () => {
    session.setMode('strip3');
    session.setCountdown(0);
    const run = session.capture(grab);
    await vi.advanceTimersByTimeAsync(0);
    expect(grab).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(grab).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(3000);
    await run;
    expect(grab).toHaveBeenCalledTimes(3);
    expect(compose).toHaveBeenCalledWith(expect.objectContaining({ layoutId: 'strip3' }));
    expect(session.photo()?.layoutId).toBe('strip3');
  });

  it('burst takes four quick shots into a grid', async () => {
    session.setMode('burst');
    session.setCountdown(0);
    const run = session.capture(grab);
    await vi.advanceTimersByTimeAsync(650 * 3 + 10);
    await run;
    expect(grab).toHaveBeenCalledTimes(4);
    expect(compose).toHaveBeenCalledWith(expect.objectContaining({ layoutId: 'grid4' }));
  });

  it('cancel during countdown returns to idle without grabbing', async () => {
    const run = session.capture(grab);
    await vi.advanceTimersByTimeAsync(1000);
    expect(session.canCancel()).toBe(true);
    session.cancel();
    await vi.advanceTimersByTimeAsync(1000);
    await run;
    expect(grab).not.toHaveBeenCalled();
    expect(session.phase()).toBe('idle');
    expect(session.countdownValue()).toBeNull();
  });

  it('ignores mode changes while busy and allows them when idle', async () => {
    const run = session.capture(grab);
    session.setMode('burst');
    expect(session.mode()).toBe('single');
    await vi.advanceTimersByTimeAsync(3000);
    await run;
    session.retake();
    session.setMode('burst');
    expect(session.mode()).toBe('burst');
  });

  it('retake clears the photo and revokes its url', async () => {
    session.setCountdown(0);
    await session.capture(grab);
    session.retake();
    expect(session.photo()).toBeNull();
    expect(session.phase()).toBe('idle');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  it('surfaces a friendly error when grabbing fails', async () => {
    session.setCountdown(0);
    await session.capture(async () => {
      throw new Error('no frame');
    });
    expect(session.error()?.code).toBe('photo-failed');
    expect(session.phase()).toBe('idle');
  });
});
