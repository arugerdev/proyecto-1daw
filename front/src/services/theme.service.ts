import { Injectable, signal, computed, effect } from '@angular/core';

export type ThemeId = 'dark' | 'light' | 'midnight' | 'forest' | 'rose' | 'amber';
export type ThemePreference = ThemeId | 'auto';

export interface ThemeDef {
  id: ThemeId;
  label: string;
  description: string;
  /** Small swatch shown in the picker (hex for preview only). */
  swatch: { bg: string; accent: string };
  /** `light` influences system-preference mapping when `auto` is selected. */
  tone: 'dark' | 'light';
}

export const THEMES: ThemeDef[] = [
  { id: 'dark',     label: 'Oscuro',     description: 'Tema oscuro clásico',            swatch: { bg: '#0f172a', accent: '#8b5cf6' }, tone: 'dark' },
  { id: 'light',    label: 'Claro',      description: 'Fondo blanco, texto oscuro',     swatch: { bg: '#f1f5f9', accent: '#7c3aed' }, tone: 'light' },
  { id: 'midnight', label: 'Medianoche', description: 'Azul profundo con acento cian',  swatch: { bg: '#080c23', accent: '#06b6d4' }, tone: 'dark' },
  { id: 'forest',   label: 'Bosque',     description: 'Tonos verdes cálidos',           swatch: { bg: '#071912', accent: '#10b981' }, tone: 'dark' },
  { id: 'rose',     label: 'Rosa',       description: 'Borgoña oscuro con acento rosa', swatch: { bg: '#1a0a12', accent: '#f43f5e' }, tone: 'dark' },
  { id: 'amber',    label: 'Ámbar',      description: 'Marrón cálido con acento ámbar', swatch: { bg: '#1c140e', accent: '#f59e0b' }, tone: 'dark' }
];

const STORAGE_KEY = 'ec_theme';
const DEFAULT_PREF: ThemePreference = 'auto';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** The user's raw preference (may be 'auto'). */
  readonly preference = signal<ThemePreference>(DEFAULT_PREF);

  /** System setting (matches prefers-color-scheme). */
  private readonly systemDark = signal<boolean>(this.readSystemDark());

  /** The *effective* theme id currently applied. Resolves 'auto'. */
  readonly active = computed<ThemeId>(() => {
    const p = this.preference();
    if (p !== 'auto') return p;
    return this.systemDark() ? 'dark' : 'light';
  });

  readonly themes = THEMES;

  constructor() {
    // Hydrate from localStorage (safely)
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
      if (saved && this.isValidPreference(saved)) {
        this.preference.set(saved);
      }
    } catch { /* private mode / storage disabled */ }

    // Apply whenever the effective theme changes
    effect(() => {
      const id = this.active();
      this.applyTheme(id);
    });

    // Watch system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => this.systemDark.set(e.matches);
      // Safari < 14 fallback
      mq.addEventListener?.('change', handler);
    }
  }

  /** Change the theme preference and persist. */
  setPreference(pref: ThemePreference) {
    if (!this.isValidPreference(pref)) return;
    this.preference.set(pref);
    try { localStorage.setItem(STORAGE_KEY, pref); } catch { /* noop */ }
  }

  /** Cycle through themes (quick-switch button). */
  cycle() {
    const order: ThemePreference[] = ['auto', 'dark', 'light', 'midnight', 'forest', 'rose', 'amber'];
    const i = order.indexOf(this.preference());
    this.setPreference(order[(i + 1) % order.length]);
  }

  /** Returns the metadata of the currently active theme (resolving 'auto'). */
  currentTheme(): ThemeDef {
    return THEMES.find(t => t.id === this.active())!;
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private readSystemDark(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private applyTheme(id: ThemeId) {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', id);
    // Keep Tailwind's `dark:` variant working where `darkMode: 'class'` is used.
    const tone = THEMES.find(t => t.id === id)?.tone ?? 'dark';
    document.documentElement.classList.toggle('dark', tone === 'dark');
  }

  private isValidPreference(p: string): p is ThemePreference {
    return p === 'auto' || THEMES.some(t => t.id === p);
  }
}
