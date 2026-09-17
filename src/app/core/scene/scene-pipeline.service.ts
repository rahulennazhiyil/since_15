import { Injectable, inject } from '@angular/core';
import { createCanvas, fitWithin, type AnyCanvas } from '../photo/image-encode';
import { decodeMask, encodeMaskPng } from '../segmentation/mask-encode';
import { SegmentationService } from '../segmentation/segmentation.service';
import { CAPTURE_PROBE_EDGE, type Mask } from '../segmentation/segmenter';
import { BackgroundResolver } from './background-resolver';
import { Scratch, drawScene, type Drawable, type PersonLayer } from './scene-compositor';
import { sceneSizeOf, type PersonRole, type SceneState } from './scene.model';

export interface ShotPerson {
  role: PersonRole;
  frame: Drawable;
  /** Decoded mask PNG or live mask canvas; null draws the raw frame. */
  mask: Drawable | null;
  /** Mirror on top of how the frame was captured (normally false for still frames). */
  mirror?: boolean;
}

export interface ShotInput {
  people: ShotPerson[];
}

/** Colour behind people when the scene has no background image. */
export const SCENE_SURFACE = '#1c1a20';

/**
 * Glue between the still-photo flow and the pure pieces: segments frames, resolves the
 * background and renders each shot into a scene canvas that the PhotoComposer then frames.
 * Mocked in session specs; the drawing itself is covered end to end.
 */
@Injectable({ providedIn: 'root' })
export class ScenePipeline {
  private readonly segmentation = inject(SegmentationService);
  private readonly backgrounds = inject(BackgroundResolver);
  private readonly scratch = new Scratch();

  /**
   * Segments a captured frame at photo quality. Returns the encoded mask PNG and the
   * decoded copy of that same PNG, so this device composites from exactly the bytes it
   * sends to the partner.
   */
  async maskForFrame(frame: ImageBitmap): Promise<{ png: Blob; bitmap: ImageBitmap; mask: Mask } | null> {
    const segmenter = await this.segmentation.load();
    if (!segmenter) return null;
    const { width, height } = fitWithin(frame.width, frame.height, CAPTURE_PROBE_EDGE);
    // Photo masks should not inherit motion from the live preview: fresh probe, single pass.
    const mask = await segmenter.segment(frame, width, height);
    const png = await encodeMaskPng(mask);
    const bitmap = await decodeMask(png);
    return { png, bitmap, mask };
  }

  /** Renders every shot into its own scene canvas (all shots share the scene state). */
  async renderShots(shots: ShotInput[], scene: SceneState): Promise<AnyCanvas[]> {
    const size = sceneSizeOf(scene.layoutId);
    const background = await this.backgrounds.resolve(scene.backgroundId);
    return shots.map((shot) => {
      const canvas = createCanvas(size.width, size.height);
      const people: PersonLayer[] = shot.people
        .filter((p) => scene.people[p.role])
        .map((p) => ({ role: p.role, image: p.frame, mask: p.mask, placement: scene.people[p.role]!, mirror: p.mirror ?? false }));
      drawScene(canvas, { background, surfaceColor: SCENE_SURFACE, fx: scene.fx, people, front: scene.front }, this.scratch);
      return canvas;
    });
  }
}
