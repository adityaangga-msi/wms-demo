import { Injectable, effect, signal } from '@angular/core';

export type AppLanguage = 'id' | 'en';
export type AppTheme = 'light' | 'dark';

const KEY = 'kartondock.preferences';

interface PrefState {
  language: AppLanguage;
  theme: AppTheme;
  animation: boolean;
}

const DEFAULTS: PrefState = {
  language: 'id',
  theme: 'light',
  animation: true,
};

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  readonly language = signal<AppLanguage>(DEFAULTS.language);
  readonly theme = signal<AppTheme>(DEFAULTS.theme);
  readonly animation = signal(DEFAULTS.animation);

  constructor() {
    this.hydrate();
    effect(() => {
      const state: PrefState = {
        language: this.language(),
        theme: this.theme(),
        animation: this.animation(),
      };
      localStorage.setItem(KEY, JSON.stringify(state));
      this.applyDom(state);
    });
  }

  setLanguage(language: AppLanguage): void {
    this.language.set(language);
  }

  setTheme(theme: AppTheme): void {
    this.theme.set(theme);
  }

  setAnimation(animation: boolean): void {
    this.animation.set(animation);
  }

  private hydrate(): void {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        this.applyDom(DEFAULTS);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<PrefState>;
      if (parsed.language === 'id' || parsed.language === 'en') this.language.set(parsed.language);
      if (parsed.theme === 'light' || parsed.theme === 'dark') this.theme.set(parsed.theme);
      if (typeof parsed.animation === 'boolean') this.animation.set(parsed.animation);
      this.applyDom({
        language: this.language(),
        theme: this.theme(),
        animation: this.animation(),
      });
    } catch {
      this.applyDom(DEFAULTS);
    }
  }

  private applyDom(state: PrefState): void {
    const root = document.documentElement;
    root.lang = state.language;
    root.dataset['theme'] = state.theme;
    root.dataset['motion'] = state.animation ? 'on' : 'off';
    root.classList.toggle('theme-dark', state.theme === 'dark');
    root.classList.toggle('motion-off', !state.animation);
  }
}
