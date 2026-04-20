import { Component, OnInit, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileService } from '../../services/file.service';

interface FsEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

@Component({
  selector: 'app-fs-browser',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="$event.target === $event.currentTarget && cancelled.emit()">
      <div class="modal-box max-w-lg w-full">

        <!-- Header -->
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
            </svg>
            <h2 class="text-base font-semibold text-surface-100">Explorador de carpetas</h2>
          </div>
          <button (click)="cancelled.emit()" class="btn-ghost btn-sm p-1.5 text-surface-400 hover:text-surface-100">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Path bar -->
        <div class="p-4 border-b border-surface-700 flex items-center gap-2">
          <button
            (click)="goUp()"
            [disabled]="!currentPath"
            class="btn-secondary btn-sm shrink-0 p-2 disabled:opacity-40"
            title="Subir un nivel">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>
            </svg>
          </button>
          <input
            [(ngModel)]="pathInput"
            (keydown.enter)="navigateTo(pathInput)"
            type="text"
            class="input flex-1 font-mono text-xs"
            [placeholder]="currentPath ? currentPath : 'Raíz del sistema de archivos'"/>
          <button (click)="navigateTo(pathInput)" class="btn-secondary btn-sm shrink-0">Ir</button>
        </div>

        <!-- Entry list -->
        <div class="p-2 min-h-[240px] max-h-[380px] overflow-y-auto">

          <!-- Loading -->
          <div *ngIf="loading" class="flex flex-col items-center justify-center h-40 gap-3">
            <svg class="w-6 h-6 animate-spin text-primary-400" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span class="text-sm text-surface-500">Cargando...</span>
          </div>

          <!-- Error -->
          <div *ngIf="!loading && errorMsg"
            class="flex items-center gap-2 p-3 m-2 rounded-lg bg-red-600/10 border border-red-600/30 text-red-400 text-sm">
            <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            {{ errorMsg }}
          </div>

          <!-- Empty -->
          <div *ngIf="!loading && !errorMsg && entries.length === 0"
            class="flex flex-col items-center justify-center h-40 gap-2 text-surface-500">
            <svg class="w-8 h-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
            </svg>
            <span class="text-sm">Sin subcarpetas</span>
          </div>

          <!-- Entries -->
          <ng-container *ngIf="!loading && !errorMsg && entries.length > 0">
            <button
              *ngFor="let entry of entries"
              (click)="navigateTo(entry.path)"
              class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors
                     hover:bg-surface-700 text-surface-200 group">
              <!-- Drive icon (root level, no separator in name) vs folder icon -->
              <ng-container *ngIf="isDriveEntry(entry); else folderIcon">
                <span class="text-lg shrink-0">💾</span>
              </ng-container>
              <ng-template #folderIcon>
                <svg class="w-5 h-5 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                </svg>
              </ng-template>
              <span class="flex-1 text-sm font-mono truncate">{{ entry.name }}</span>
              <svg class="w-4 h-4 text-surface-600 group-hover:text-surface-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </ng-container>
        </div>

        <!-- Footer -->
        <div class="p-4 border-t border-surface-700 space-y-3">
          <!-- Info -->
          <div class="flex items-center gap-2 text-xs text-surface-500 min-h-[20px]">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span *ngIf="currentPath" class="font-mono truncate">Se usará: {{ currentPath }}</span>
            <span *ngIf="!currentPath">Navega a una carpeta y pulsa "Usar esta carpeta"</span>
          </div>

          <!-- Actions -->
          <div class="flex gap-2 justify-end">
            <button (click)="cancelled.emit()" class="btn-secondary btn-sm">Cancelar</button>
            <button
              (click)="selectCurrent()"
              [disabled]="!currentPath"
              class="btn-primary btn-sm disabled:opacity-40">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              Usar esta carpeta
            </button>
          </div>
        </div>

      </div>
    </div>
  `
})
export class FsBrowserComponent implements OnInit {
  @Input() initialPath = '';
  @Output() selected = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();

  currentPath = '';
  pathInput = '';
  entries: FsEntry[] = [];
  loading = false;
  errorMsg = '';

  constructor(private fileService: FileService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.currentPath = this.initialPath ?? '';
    this.pathInput = this.currentPath;
    this.browse(this.currentPath);
  }

  browse(path: string) {
    this.loading = true;
    this.errorMsg = '';
    this.fileService.browseFilesystem(path || undefined).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res.success) {
          // Only show directories, sorted alphabetically
          this.entries = (res.data as FsEntry[])
            .filter(e => e.isDirectory)
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        } else {
          this.errorMsg = res.error || 'Error al obtener el directorio';
          this.entries = [];
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.errorMsg = 'No se pudo conectar con el servidor';
        this.entries = [];
        this.cdr.detectChanges();
      }
    });
  }

  navigateTo(path: string) {
    if (!path) return;
    this.currentPath = path;
    this.pathInput = path;
    this.browse(path);
  }

  goUp() {
    const path = this.stripTrailingSep(this.currentPath);

    if (!path) return; // already at root list

    // Windows drive root: e.g. "C:\" or "C:" → go to drive list
    if (/^[A-Za-z]:\\?$/.test(path) || /^[A-Za-z]:$/.test(path)) {
      this.currentPath = '';
      this.pathInput = '';
      this.browse('');
      return;
    }

    // Linux root "/"
    if (path === '/') {
      this.currentPath = '';
      this.pathInput = '';
      this.browse('');
      return;
    }

    // Windows path: split on backslash
    if (path.includes('\\')) {
      const parts = path.split('\\');
      parts.pop();
      const parent = parts.join('\\') || '';
      // If parent is just "C:" add trailing slash so it's a valid drive root
      const normalized = /^[A-Za-z]:$/.test(parent) ? parent + '\\' : parent;
      this.currentPath = normalized;
      this.pathInput = normalized;
      this.browse(normalized);
      return;
    }

    // Unix path
    const lastSlash = path.lastIndexOf('/');
    if (lastSlash <= 0) {
      // at top-level dir e.g. "/home" → go to "/"
      const parent = '/';
      this.currentPath = parent;
      this.pathInput = parent;
      this.browse(parent);
    } else {
      const parent = path.substring(0, lastSlash) || '/';
      this.currentPath = parent;
      this.pathInput = parent;
      this.browse(parent);
    }
  }

  selectCurrent() {
    if (this.currentPath) {
      this.selected.emit(this.currentPath);
    }
  }

  isDriveEntry(entry: FsEntry): boolean {
    // A Windows drive at root level: name like "C:\", "D:\" or "C:", "D:"
    return /^[A-Za-z]:\\?$/.test(entry.path) || /^[A-Za-z]:$/.test(entry.path);
  }

  private stripTrailingSep(p: string): string {
    // Remove trailing backslash unless it's a drive root "C:\"
    if (/^[A-Za-z]:\\$/.test(p)) return p; // keep "C:\"
    return p.replace(/[/\\]+$/, '');
  }
}
