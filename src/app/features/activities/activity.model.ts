import type { Type } from '@angular/core';
import type { IconName } from '../../shared/ui/icon';

export type ActivityId =
  | 'question-cards'
  | 'this-or-that'
  | 'would-you-rather'
  | 'message-cards'
  | 'drawing'
  | 'bucket-list'
  | 'countdown'
  | 'distance';

export interface ActivityDefinition {
  id: ActivityId;
  name: string;
  description: string;
  icon: IconName;
  /** Works without a partner (solo room or /activities page). */
  solo: boolean;
  load: () => Promise<Type<unknown>>;
  /** Inputs handed to the component (e.g. which deck to use). */
  inputs?: Record<string, unknown>;
}

/**
 * The catalogue. Adding an activity is one entry here plus a folder; nothing else in
 * the app needs to know about it.
 */
export const ACTIVITIES: readonly ActivityDefinition[] = [
  {
    id: 'question-cards',
    name: 'Question cards',
    description: 'Little prompts to talk about.',
    icon: 'heart',
    solo: true,
    load: () => import('./question-cards/question-cards').then((m) => m.QuestionCards),
  },
  {
    id: 'this-or-that',
    name: 'This or that',
    description: 'Pick fast, then compare.',
    icon: 'shapes',
    solo: false,
    load: () => import('./two-choices/two-choices').then((m) => m.TwoChoices),
    inputs: { deck: 'this-or-that' },
  },
  {
    id: 'would-you-rather',
    name: 'Would you rather',
    description: 'Impossible choices, together.',
    icon: 'sparkles',
    solo: false,
    load: () => import('./two-choices/two-choices').then((m) => m.TwoChoices),
    inputs: { deck: 'would-you-rather' },
  },
  {
    id: 'message-cards',
    name: 'Message cards',
    description: 'Send a tiny note across.',
    icon: 'type',
    solo: false,
    load: () => import('./message-cards/message-cards').then((m) => m.MessageCards),
  },
  {
    id: 'drawing',
    name: 'Draw together',
    description: 'One canvas, two pens.',
    icon: 'pencil',
    solo: true,
    load: () => import('./drawing/drawing').then((m) => m.Drawing),
  },
  {
    id: 'bucket-list',
    name: 'Our bucket list',
    description: 'Things to do when you are together.',
    icon: 'check',
    solo: true,
    load: () => import('./bucket-list/bucket-list').then((m) => m.BucketList),
  },
  {
    id: 'countdown',
    name: 'Countdown',
    description: 'Days until the next time.',
    icon: 'timer',
    solo: true,
    load: () => import('./countdown/countdown').then((m) => m.CountdownActivity),
  },
  {
    id: 'distance',
    name: 'Distance',
    description: 'How far apart, right now.',
    icon: 'link',
    solo: true,
    load: () => import('./distance/distance').then((m) => m.Distance),
  },
];
