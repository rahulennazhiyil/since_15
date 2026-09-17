import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Stroke icons on a 24 px grid. Add an entry here; never inline SVG in templates. */
const ICONS = {
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  camera:
    'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  heart:
    'M12 20.5C6.5 17 3.5 13.7 3.5 9.9 3.5 7.2 5.6 5 8.2 5c1.6 0 3 .8 3.8 2.1C12.8 5.8 14.2 5 15.8 5c2.6 0 4.7 2.2 4.7 4.9 0 3.8-3 7.1-8.5 10.6z',
  images:
    'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M3 16l5-5 4 4 3-3 6 6 M15.5 9.5h.01',
  sparkles:
    'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z M5 3l.5 1.5L7 5l-1.5.5L5 7l-.5-1.5L3 5l1.5-.5z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v5 M12 8h.01',
  palette:
    'M12 3a9 9 0 0 0 0 18c1.2 0 2-.8 2-2v-1.5c0-.8.7-1.5 1.5-1.5H17a4 4 0 0 0 4-4c0-5-4-9-9-9z M8 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M11 7.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M15.5 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  close: 'M6 6l12 12 M18 6L6 18',
  copy: 'M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  share: 'M12 3v12 M8 7l4-4 4 4 M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  'arrow-right': 'M5 12h14 M13 6l6 6-6 6',
  'chevron-left': 'M15 5l-7 7 7 7',
  check: 'M5 12.5l4.5 4.5L19 7',
  flip: 'M20 12a8 8 0 0 1-14.9 4 M4 12a8 8 0 0 1 14.9-4 M4 20v-4h4 M20 4v4h-4',
  sliders: 'M4 6h10 M18 6h2 M4 12h4 M12 12h8 M4 18h12 M20 18h.01 M14 4v4 M8 10v4 M16 16v4',
  download: 'M12 3v12 M8 11l4 4 4-4 M5 19h14',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5',
  warning: 'M12 3l10 18H2z M12 10v4 M12 17.5h.01',
  menu: 'M4 7h16 M4 12h16 M4 17h16',
  plus: 'M12 5v14 M5 12h14',
  lock: 'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z M8 11V8a4 4 0 0 1 8 0v3 M12 15v2',
  shield: 'M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z M9 12l2 2 4-4',
  'sound-on': 'M4 10v4h3l4 3V7l-4 3H4z M15 9.5a3.5 3.5 0 0 1 0 5 M17.5 7a7 7 0 0 1 0 10',
  'sound-off': 'M4 10v4h3l4 3V7l-4 3H4z M16 9.5l4 4 M20 9.5l-4 4',
  timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M12 9v4l2.5 1.5 M9 3h6',
  retry: 'M4 12a8 8 0 0 1 13.7-5.6L20 8 M20 4v4h-4 M20 12a8 8 0 0 1-13.7 5.6L4 16 M4 20v-4h4',
  trash: 'M5 7h14 M9 7V5h6v2 M7 7l1 13h8l1-13 M10 11v6 M14 11v6',
  pencil: 'M4 20l4-1L19 8l-3-3L5 16z M14 7l3 3',
  type: 'M5 6h14 M12 6v13 M9 19h6',
  smile: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8 M9 10h.01 M15 10h.01',
  shapes: 'M12 3l4 7H8z M4 14h6v6H4z M17 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  mic: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z M6 11a6 6 0 0 0 12 0 M12 17v4 M9 21h6',
  'mic-off': 'M9 9v3a3 3 0 0 0 5.1 2.1 M15 9.3V6a3 3 0 0 0-5.7-1.3 M6 11a6 6 0 0 0 9.7 4.7 M18 11c0 .9-.2 1.7-.5 2.4 M12 17v4 M9 21h6 M4 4l16 16',
} as const;

export type IconName = keyof typeof ICONS;

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 24 24"
      [attr.fill]="filled() ? 'currentColor' : 'none'"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      [attr.width]="size()"
      [attr.height]="size()"
      aria-hidden="true"
      focusable="false"
    >
      <path [attr.d]="path()" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      line-height: 0;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input<number>(20);
  /** Solid rendering, for the few marks (heart, shutter dot) that read better filled. */
  readonly filled = input(false);
  protected readonly path = computed(() => ICONS[this.name()]);
}
