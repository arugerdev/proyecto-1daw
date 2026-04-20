import { Component, HostListener, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService, THEMES, ThemePreference } from '../../services/theme.service';
import { IconComponent } from '../icon/icon.component';

/**
 * Dropdown button that lets the user pick a theme (or "Auto" for system
 * preference). Meant to live in headers / sidebars as a small icon button.
 */
@Component({
  selector: 'app-theme-picker',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="relative">
      <!-- Trigger: palette icon -->
      <button type="button" (click)="open = !open"
        class="btn-ghost btn-sm p-2 relative"
        [title]="'Tema: ' + currentLabel()">
        <app-icon name="palette" class="w-5 h-5 text-surface-300"></app-icon>
      </button>

      <!-- Dropdown -->
      <div *ngIf="open"
        class="absolute right-0 mt-1 w-64 bg-surface-800 border border-surface-700 rounded-xl
               shadow-2xl z-50 overflow-hidden animate-fade-in">

        <div class="p-3 border-b border-surface-700">
          <p class="text-xs font-semibold text-surface-400 uppercase tracking-wider">Tema</p>
          <p class="text-xs text-surface-500 mt-0.5">Elige tu apariencia favorita</p>
        </div>

        <div class="p-1 max-h-[360px] overflow-y-auto">
          <!-- Auto -->
          <button type="button"
            (click)="choose('auto')"
            class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors
                   hover:bg-surface-700"
            [class.bg-primary-600\/15]="pref() === 'auto'">
            <span class="shrink-0 w-7 h-7 rounded-lg border border-surface-600 bg-surface-900/50
                         flex items-center justify-center">
              <app-icon name="monitor" class="w-4 h-4 text-surface-300"></app-icon>
            </span>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium"
                [class.text-primary-300]="pref() === 'auto'"
                [class.text-surface-100]="pref() !== 'auto'">Automático</p>
              <p class="text-xs text-surface-500">Según preferencia del sistema</p>
            </div>
            <app-icon *ngIf="pref() === 'auto'" name="check"
              class="w-4 h-4 text-primary-400 shrink-0"></app-icon>
          </button>

          <div class="my-1 border-t border-surface-700/50"></div>

          <!-- Each theme -->
          <button *ngFor="let t of themes"
            type="button"
            (click)="choose(t.id)"
            class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors
                   hover:bg-surface-700"
            [class.bg-primary-600\/15]="pref() === t.id">

            <!-- swatch -->
            <span class="relative shrink-0 w-7 h-7 rounded-lg border border-surface-600 overflow-hidden"
              [style.background-color]="t.swatch.bg">
              <span class="absolute bottom-0 right-0 w-3 h-3 rounded-tl"
                [style.background-color]="t.swatch.accent"></span>
            </span>

            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium"
                [class.text-primary-300]="pref() === t.id"
                [class.text-surface-100]="pref() !== t.id">
                {{ t.label }}
              </p>
              <p class="text-xs text-surface-500 truncate">{{ t.description }}</p>
            </div>

            <app-icon *ngIf="pref() === t.id" name="check"
              class="w-4 h-4 text-primary-400 shrink-0"></app-icon>
          </button>
        </div>
      </div>
    </div>
  `
})
export class ThemePickerComponent {
  private readonly theme = inject(ThemeService);
  private readonly el = inject(ElementRef);

  open = false;
  readonly themes = THEMES;
  readonly pref = this.theme.preference;

  currentLabel(): string {
    const p = this.theme.preference();
    if (p === 'auto') return `Automático (${this.theme.currentTheme().label})`;
    return this.theme.currentTheme().label;
  }

  choose(pref: ThemePreference) {
    this.theme.setPreference(pref);
    this.open = false;
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    if (this.open && !this.el.nativeElement.contains(e.target)) {
      this.open = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEsc() { this.open = false; }
}
