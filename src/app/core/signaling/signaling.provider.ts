import type { Provider } from '@angular/core';
import { environment } from '../../../environments/environment';
import { BroadcastChannelSignaling } from './broadcast-channel-signaling';
import { LazySignaling } from './lazy-signaling';
import { SIGNALING_TRANSPORT, type SignalingTransport } from './signaling-transport';

/** Chooses the transport once, from the environment. Components only ever see the token. */
export function createSignalingTransport(): SignalingTransport {
  const { provider, supabaseUrl, supabaseAnonKey } = environment.signaling;
  if (provider === 'supabase' && supabaseUrl && supabaseAnonKey) {
    return new LazySignaling(async () => {
      const { SupabaseSignaling } = await import('./supabase-signaling');
      return new SupabaseSignaling(supabaseUrl, supabaseAnonKey);
    });
  }
  // Development, and production builds without Supabase values: same browser only.
  return new BroadcastChannelSignaling();
}

export function provideSignaling(): Provider {
  return { provide: SIGNALING_TRANSPORT, useFactory: createSignalingTransport };
}
