import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';

@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Button, Icon],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
  protected readonly filters = ['Original', 'Soft', 'Film', 'Warm', 'Dream', 'Mono'];

  protected readonly points = [
    {
      icon: 'link' as const,
      title: 'Nothing to install',
      text: 'Open a link in any modern browser. Phone or laptop, it just works.',
    },
    {
      icon: 'sparkles' as const,
      title: 'Filters you make yourself',
      text: 'Start from our presets or build your own look and keep it.',
    },
    {
      icon: 'shield' as const,
      title: 'Photos stay with you',
      text: 'Your camera never leaves your browser and nothing is uploaded.',
    },
  ];

  protected readonly steps = [
    { n: '01', title: 'Start a room', text: 'Pick a name and a vibe. Allow your camera.' },
    { n: '02', title: 'Send one link', text: 'Your person opens it and appears next to you.' },
    { n: '03', title: 'Count down together', text: 'Three, two, one. Same moment, same frame.' },
  ];
}
