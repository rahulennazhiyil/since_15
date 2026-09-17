import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('creates the shell with header, navigation and toast outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-header')).not.toBeNull();
    expect(el.querySelector('app-bottom-bar')).not.toBeNull();
    expect(el.querySelector('app-toasts')).not.toBeNull();
    expect(el.querySelector('main#main')).not.toBeNull();
  });

  it('applies the default theme to the document', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(document.documentElement.getAttribute('data-theme')).toBe('soft');
  });
});
