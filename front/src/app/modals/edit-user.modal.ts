import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { User, UserRole, ROLE_LABELS, ROLE_COLORS } from '../models/file.model';
import { AuthService } from '../../services/auth.service';
import { IconComponent } from '../../components/icon/icon.component';

/**
 * Edit a single user: username, role, optional password change.
 * Opens/closes via `*ngIf` in the parent. Emits:
 *   - `saved` on successful update (parent should refresh its user list)
 *   - `close` when the user dismisses the modal
 */
@Component({
  selector: 'app-edit-user-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div *ngIf="user" class="modal-overlay" (click)="close.emit()">
      <div class="modal-box max-w-md" (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="modal-header">
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-9 h-9 bg-primary-600/20 rounded-lg flex items-center justify-center shrink-0">
              <svg class="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </div>
            <div class="min-w-0">
              <h2 class="text-base font-semibold text-surface-100 truncate">Editar usuario</h2>
              <p class="text-xs text-surface-500 truncate">{{ user.username }}</p>
            </div>
          </div>
          <button (click)="close.emit()" class="btn-ghost btn-sm p-1.5" [disabled]="saving">
            <app-icon name="close" class="w-5 h-5"></app-icon>
          </button>
        </div>

        <!-- Body -->
        <div class="p-5 space-y-4">

          <!-- Current role badge -->
          <div class="flex items-center gap-2 text-sm">
            <span class="text-surface-500">Rol actual:</span>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
              [class]="ROLE_COLORS[user.role]">
              {{ ROLE_LABELS[user.role] }}
            </span>
          </div>

          <!-- Username -->
          <div>
            <label class="input-label">Nombre de usuario</label>
            <input [(ngModel)]="patch.username" type="text" class="input"
              placeholder="Nombre de usuario" [disabled]="saving"/>
            <p class="text-xs text-surface-600 mt-1">
              Sólo letras, números, guiones y guiones bajos.
            </p>
          </div>

          <!-- Role -->
          <div>
            <label class="input-label">Rol</label>
            <select [(ngModel)]="patch.role" class="select" [disabled]="saving">
              <option value="viewer">Visualizador</option>
              <option value="moderator">Moderador</option>
              <option value="admin">Administrador</option>
              <option *ngIf="auth.hasRole('owner')" value="owner">Propietario</option>
            </select>
          </div>

          <!-- Password section (optional) -->
          <div class="border-t border-surface-700 pt-4 space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-surface-200">Cambiar contraseña</p>
                <p class="text-xs text-surface-500">Déjalo en blanco para no modificarla</p>
              </div>
              <button type="button" (click)="changePw = !changePw; clearPasswords()"
                class="btn-ghost btn-sm text-xs"
                [class.text-primary-300]="changePw"
                [disabled]="saving">
                {{ changePw ? 'Cancelar' : 'Cambiar' }}
              </button>
            </div>

            <div *ngIf="changePw" class="space-y-3">
              <div>
                <label class="input-label">Nueva contraseña</label>
                <div class="relative">
                  <input [(ngModel)]="patch.password"
                    [type]="showPw ? 'text' : 'password'"
                    placeholder="Mínimo 6 caracteres"
                    class="input pr-10" [disabled]="saving"/>
                  <button type="button" (click)="showPw = !showPw"
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300 transition-colors">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        [attr.d]="showPw
                          ? 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21'
                          : 'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <label class="input-label">Confirmar contraseña</label>
                <input [(ngModel)]="patchConfirm"
                  [type]="showPw ? 'text' : 'password'"
                  placeholder="Repite la contraseña"
                  class="input" [disabled]="saving"
                  [class.border-red-500]="patch.password && patchConfirm && patch.password !== patchConfirm"
                  [class.border-emerald-500]="patch.password && patchConfirm && patch.password === patchConfirm"/>
              </div>
              <p *ngIf="patch.password && patch.password.length < 6"
                class="text-xs text-amber-400">
                La contraseña debe tener al menos 6 caracteres.
              </p>
              <p *ngIf="patch.password && patchConfirm && patch.password !== patchConfirm"
                class="text-xs text-red-400">
                Las contraseñas no coinciden.
              </p>
            </div>
          </div>

          <!-- Error banner -->
          <div *ngIf="error" class="flex items-center gap-2 p-3 rounded-lg bg-red-600/10 border border-red-600/30 text-red-400 text-sm">
            <app-icon name="alert-triangle" class="w-4 h-4 shrink-0"></app-icon>
            <span>{{ error }}</span>
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-3 pt-2 border-t border-surface-700">
            <button (click)="close.emit()" class="btn-secondary" [disabled]="saving">Cancelar</button>
            <button (click)="submit()" class="btn-primary" [disabled]="saving || !isValid()">
              <svg *ngIf="saving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              {{ saving ? 'Guardando...' : 'Guardar cambios' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class EditUserModalComponent implements OnInit, OnChanges {
  @Input() user: User | null = null;
  @Output() saved = new EventEmitter<User>();
  @Output() close = new EventEmitter<void>();

  readonly ROLE_LABELS = ROLE_LABELS;
  readonly ROLE_COLORS = ROLE_COLORS;

  patch = { username: '', role: 'viewer' as UserRole, password: '' };
  patchConfirm = '';
  changePw = false;
  showPw = false;
  saving = false;
  error = '';

  constructor(public auth: AuthService, private cdr: ChangeDetectorRef) {}

  ngOnInit() { this.hydrate(); }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['user']) this.hydrate();
  }

  private hydrate() {
    if (!this.user) return;
    this.patch = { username: this.user.username, role: this.user.role, password: '' };
    this.patchConfirm = '';
    this.changePw = false;
    this.showPw = false;
    this.error = '';
  }

  clearPasswords() {
    this.patch.password = '';
    this.patchConfirm = '';
    this.showPw = false;
  }

  isValid(): boolean {
    if (!this.user) return false;
    if (!this.patch.username.trim()) return false;
    if (!/^[a-zA-Z0-9_-]+$/.test(this.patch.username)) return false;
    if (this.changePw) {
      if (!this.patch.password || this.patch.password.length < 6) return false;
      if (this.patch.password !== this.patchConfirm) return false;
    }
    return true;
  }

  submit() {
    if (!this.user || !this.isValid()) return;
    this.error = '';
    this.saving = true;

    const patch: any = { role: this.patch.role };
    if (this.patch.username !== this.user.username) patch.username = this.patch.username.trim();
    if (this.changePw && this.patch.password) patch.password = this.patch.password;

    this.auth.updateUser(this.user.id, patch).subscribe({
      next: res => {
        this.saving = false;
        if (res.success) {
          this.saved.emit(this.user!);
        } else {
          this.error = res.error || 'No se pudo actualizar el usuario';
          this.cdr.detectChanges();
        }
      },
      error: err => {
        this.saving = false;
        this.error = err.error?.error || 'Error al actualizar el usuario';
        this.cdr.detectChanges();
      }
    });
  }
}
