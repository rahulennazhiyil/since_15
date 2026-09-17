import { Routes } from '@angular/router';
import { cameraSupportGuard } from './core/permissions/camera-support.guard';

/**
 * Every feature route is lazy. Routes marked `immersive` hide the header and bottom bar
 * so the camera can take the whole screen.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/landing/landing').then((m) => m.Landing),
  },
  {
    path: 'booth',
    title: 'Camera',
    data: { immersive: true },
    canActivate: [cameraSupportGuard],
    loadComponent: () => import('./features/booth/booth-page').then((m) => m.BoothPage),
  },
  {
    path: 'unsupported',
    title: 'Not supported',
    loadComponent: () => import('./features/placeholder/unsupported').then((m) => m.Unsupported),
  },
  {
    path: 'room/new',
    title: 'Start a Room',
    loadComponent: () => import('./features/room/create-room-page').then((m) => m.CreateRoomPage),
  },
  {
    path: 'room/join',
    title: 'Join a Room',
    loadComponent: () => import('./features/room/join-room-page').then((m) => m.JoinRoomPage),
  },
  {
    path: 'room/:code',
    title: 'Room',
    data: { immersive: true },
    canActivate: [cameraSupportGuard],
    loadComponent: () => import('./features/room/room-page').then((m) => m.RoomPage),
  },
  {
    path: 'filters',
    title: 'My Filters',
    loadComponent: () => import('./features/filters/my-filters-page').then((m) => m.MyFiltersPage),
  },
  {
    path: 'filters/new',
    title: 'New Filter',
    data: { immersive: true },
    loadComponent: () => import('./features/filters/filter-editor-page').then((m) => m.FilterEditorPage),
  },
  {
    path: 'filters/:id',
    title: 'Edit Filter',
    data: { immersive: true },
    loadComponent: () => import('./features/filters/filter-editor-page').then((m) => m.FilterEditorPage),
  },
  {
    path: 'memories',
    title: 'Memories',
    loadComponent: () => import('./features/memories/memories-page').then((m) => m.MemoriesPage),
  },
  {
    path: 'activities',
    title: 'Activities',
    loadComponent: () => import('./features/activities/activities-page').then((m) => m.ActivitiesPage),
  },
  {
    path: 'privacy',
    title: 'Privacy',
    loadComponent: () => import('./features/privacy/privacy').then((m) => m.Privacy),
  },
  {
    path: 'about',
    title: 'About',
    loadComponent: () => import('./features/about/about').then((m) => m.About),
  },
  {
    path: '**',
    title: 'Not found',
    loadComponent: () => import('./features/placeholder/not-found').then((m) => m.NotFound),
  },
];
