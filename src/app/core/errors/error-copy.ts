import type { AppErrorCode } from './app-error';

export interface ErrorCopy {
  title: string;
  message: string;
  /** Label for the primary recovery action, when there is one. */
  action?: string;
}

/**
 * Every user-facing error string lives here. Nothing in this file may mention a
 * browser API, protocol, or exception name.
 */
export const ERROR_COPY: Record<AppErrorCode, ErrorCopy> = {
  'camera-denied': {
    title: 'Camera access was blocked',
    message: 'Please allow camera access in your browser settings, then try again.',
    action: 'Try again',
  },
  'microphone-denied': {
    title: 'Microphone access was blocked',
    message: 'You can still take photos. Allow microphone access in your browser settings if you want to talk.',
    action: 'Continue without sound',
  },
  'camera-missing': {
    title: 'No camera found',
    message: 'We could not find a camera on this device. Plug one in or try another device.',
  },
  'camera-busy': {
    title: 'Your camera is in use',
    message: 'Another app or tab is using the camera. Close it and try again.',
    action: 'Try again',
  },
  'insecure-context': {
    title: 'This page needs a secure connection',
    message: 'Cameras only work over HTTPS. Open the site using a secure address.',
  },
  'browser-unsupported': {
    title: 'This browser can’t run the booth',
    message: 'Try the latest Chrome, Safari, Edge or Firefox.',
  },
  'connection-failed': {
    title: 'We couldn’t connect you two',
    message: 'Something between your networks is getting in the way. Give it another go.',
    action: 'Retry',
  },
  'network-interrupted': {
    title: 'Connection interrupted',
    message: 'Trying again…',
  },
  'room-not-found': {
    title: 'We couldn’t find that room',
    message: 'Check the code, or ask your person to start a new room.',
    action: 'Start a room',
  },
  'room-full': {
    title: 'This room is full',
    message: 'Rooms are made for two. Start your own to invite someone.',
    action: 'Start a room',
  },
  'room-ended': {
    title: 'This room has ended',
    message: 'The host left. You can start a new one in a few seconds.',
    action: 'Start a room',
  },
  'partner-left': {
    title: 'Your person left the room',
    message: 'Keep the room open in case they come back, or head home.',
  },
  'invalid-room-code': {
    title: 'That code doesn’t look right',
    message: 'Room codes are six letters and numbers.',
  },
  'photo-failed': {
    title: 'The photo didn’t come out',
    message: 'Something went wrong while making your picture. Take another?',
    action: 'Retake',
  },
  'scene-unsupported': {
    title: 'The shared scene needs a newer device',
    message: 'This device can’t cut you out of your background yet, so you’ll appear side by side instead.',
  },
  'storage-failed': {
    title: 'Couldn’t save that',
    message: 'Your browser storage is full or unavailable. You can still download photos.',
  },
  unknown: {
    title: 'Something went wrong',
    message: 'Please try that once more.',
  },
};
