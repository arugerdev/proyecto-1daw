import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Central SVG icon library. Replaces all emojis across the app.
 *
 * Usage:
 *   <app-icon name="palette" class="w-5 h-5 text-primary-400"></app-icon>
 *
 * Style the icon via Tailwind classes on the host element — the SVG
 * inherits `currentColor` so text-* utilities work.
 */
export type IconName =
  // UI chrome
  | 'palette' | 'monitor' | 'sun' | 'moon'
  | 'close' | 'check' | 'check-circle' | 'x-circle' | 'alert-triangle'
  | 'arrow-left' | 'arrow-right'
  | 'search' | 'inbox' | 'plus' | 'minus'
  // Media kinds
  | 'video' | 'music' | 'image' | 'document' | 'text' | 'package'
  // Storage types
  | 'drive' | 'globe' | 'server' | 'antenna' | 'network' | 'folder'
  // CSV / data
  | 'table';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
      [attr.aria-label]="name" role="img" class="w-full h-full">
      <ng-container [ngSwitch]="name">

        <!-- ═ UI chrome ═══════════════════════════════════════════════════ -->
        <ng-container *ngSwitchCase="'palette'">
          <path d="M12 3c4.97 0 9 3.58 9 8 0 2.76-2.24 5-5 5h-1.5a1.5 1.5 0 0 0-1.06 2.56l.31.32A1.5 1.5 0 0 1 12.69 21H12c-4.97 0-9-4.03-9-9s4.03-9 9-9Z"/>
          <circle cx="7.5" cy="10.5" r="1" fill="currentColor"/>
          <circle cx="12" cy="7.5" r="1" fill="currentColor"/>
          <circle cx="16.5" cy="10.5" r="1" fill="currentColor"/>
          <circle cx="8" cy="14.5" r="1" fill="currentColor"/>
        </ng-container>

        <ng-container *ngSwitchCase="'monitor'">
          <rect x="2.5" y="4" width="19" height="13" rx="2"/>
          <path d="M8 21h8M12 17v4"/>
        </ng-container>

        <ng-container *ngSwitchCase="'sun'">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
        </ng-container>

        <ng-container *ngSwitchCase="'moon'">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>
        </ng-container>

        <ng-container *ngSwitchCase="'close'">
          <path d="M6 6l12 12M6 18L18 6"/>
        </ng-container>

        <ng-container *ngSwitchCase="'check'">
          <path d="M5 13l4 4L19 7"/>
        </ng-container>

        <ng-container *ngSwitchCase="'check-circle'">
          <circle cx="12" cy="12" r="9"/>
          <path d="M8.5 12.5l2.5 2.5 4.5-5"/>
        </ng-container>

        <ng-container *ngSwitchCase="'x-circle'">
          <circle cx="12" cy="12" r="9"/>
          <path d="M9 9l6 6M15 9l-6 6"/>
        </ng-container>

        <ng-container *ngSwitchCase="'alert-triangle'">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/>
          <path d="M12 9v4M12 17h.01"/>
        </ng-container>

        <ng-container *ngSwitchCase="'arrow-left'">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </ng-container>

        <ng-container *ngSwitchCase="'arrow-right'">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </ng-container>

        <ng-container *ngSwitchCase="'search'">
          <circle cx="11" cy="11" r="7"/>
          <path d="M21 21l-4.35-4.35"/>
        </ng-container>

        <ng-container *ngSwitchCase="'inbox'">
          <path d="M22 12h-6l-2 3h-4l-2-3H2"/>
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/>
        </ng-container>

        <ng-container *ngSwitchCase="'plus'">
          <path d="M12 5v14M5 12h14"/>
        </ng-container>

        <ng-container *ngSwitchCase="'minus'">
          <path d="M5 12h14"/>
        </ng-container>

        <!-- ═ Media kinds ═════════════════════════════════════════════════ -->
        <ng-container *ngSwitchCase="'video'">
          <rect x="2" y="6" width="14" height="12" rx="2"/>
          <path d="M22 8l-6 4 6 4V8Z"/>
        </ng-container>

        <ng-container *ngSwitchCase="'music'">
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        </ng-container>

        <ng-container *ngSwitchCase="'image'">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="9" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </ng-container>

        <ng-container *ngSwitchCase="'document'">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
          <path d="M14 2v6h6M9 13h6M9 17h6M9 9h2"/>
        </ng-container>

        <ng-container *ngSwitchCase="'text'">
          <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2M9 20h6M12 4v16"/>
        </ng-container>

        <ng-container *ngSwitchCase="'package'">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
          <path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"/>
        </ng-container>

        <!-- ═ Storage types ══════════════════════════════════════════════ -->
        <ng-container *ngSwitchCase="'drive'">
          <rect x="2" y="5" width="20" height="14" rx="2"/>
          <path d="M6 9h.01M10 9h.01"/>
        </ng-container>

        <ng-container *ngSwitchCase="'globe'">
          <circle cx="12" cy="12" r="9"/>
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>
        </ng-container>

        <ng-container *ngSwitchCase="'server'">
          <rect x="2" y="3" width="20" height="7" rx="1.5"/>
          <rect x="2" y="14" width="20" height="7" rx="1.5"/>
          <path d="M6 6.5h.01M6 17.5h.01"/>
        </ng-container>

        <ng-container *ngSwitchCase="'antenna'">
          <path d="M5 12c0-3.87 3.13-7 7-7M5 12c0 3.87 3.13 7 7 7M19 12c0-3.87-3.13-7-7-7M19 12c0 3.87-3.13 7-7 7"/>
          <circle cx="12" cy="12" r="2"/>
        </ng-container>

        <ng-container *ngSwitchCase="'network'">
          <rect x="9" y="2" width="6" height="6" rx="1"/>
          <rect x="2" y="16" width="6" height="6" rx="1"/>
          <rect x="16" y="16" width="6" height="6" rx="1"/>
          <path d="M5 16v-4h14v4M12 8v4"/>
        </ng-container>

        <ng-container *ngSwitchCase="'folder'">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>
        </ng-container>

        <!-- ═ Data / CSV ═════════════════════════════════════════════════ -->
        <ng-container *ngSwitchCase="'table'">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>
        </ng-container>

      </ng-container>
    </svg>
  `,
  styles: [`:host { display: inline-flex; align-items: center; justify-content: center; }`]
})
export class IconComponent {
  @Input() name: IconName = 'package';
}
