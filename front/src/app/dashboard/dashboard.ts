import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { FileService } from '../../services/file.service';
import { User, StorageLocation, Category, Tag, Stats, ROLE_LABELS, ROLE_COLORS, UserRole } from '../models/file.model';
import { FsBrowserComponent } from '../../components/fs-browser/fs-browser.component';

type Tab = 'overview' | 'users' | 'locations' | 'categories' | 'system';

@Component({
  selector: 'dashboard-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, FsBrowserComponent],
  templateUrl: './page.html'
})
export class DashboardPage implements OnInit, OnDestroy {
  activeTab: Tab = 'overview';

  // Data
  users: User[] = [];
  locations: StorageLocation[] = [];
  categories: Category[] = [];
  tags: Tag[] = [];
  stats: Stats | null = null;

  // Inline forms
  newUser = { username: '', password: '', role: 'viewer' as UserRole };
  newLocation = { name: '', base_path: '', storage_type: 'local' as any, description: '' };
  newCategory = { name: '', description: '', color: '#6366f1', icon: 'folder' };

  // Edit state
  editingUser: User | null = null;
  editUserPatch = { username: '', role: 'viewer' as UserRole, password: '' };
  editUserPatchConfirm = '';
  editUserShowPw = false;

  // UI
  loading = false;
  saving = false;
  error = '';
  success = '';
  showAddUser = false;
  showAddLocation = false;
  showAddCategory = false;
  showFsBrowser = false;

  // Update
  updateStatus: any = null;
  version = '';

  // Update packages
  updatePackages: any[] = [];
  updateCheckResult: any = null;
  uploadingPkg = false;
  applyingPkg = '';
  checkingUpdates = false;

  readonly ROLE_LABELS = ROLE_LABELS;
  readonly ROLE_COLORS = ROLE_COLORS;
  readonly TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview',   label: 'Resumen',      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'users',      label: 'Usuarios',     icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { id: 'locations',  label: 'Ubicaciones',  icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
    { id: 'categories', label: 'Categorías',   icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
    { id: 'system',     label: 'Sistema',      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }
  ];

  private destroy$ = new Subject<void>();

  constructor(public auth: AuthService, public fs: FileService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadData();
    if (this.auth.hasPermission('canPerformUpdates')) {
      this.loadUpdatePackages();
    }
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  private loadData() {
    this.loading = true;
    forkJoin({
      stats: this.fs.getStats(),
      users: this.auth.getUsers(),
      locations: this.fs.getLocations(),
      categories: this.fs.getCategories(),
      tags: this.fs.getTags()
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ stats, users, locations, categories, tags }) => {
        if (stats.success) this.stats = stats.data;
        if (users.success) this.users = users.data;
        if (locations.success) this.locations = locations.data;
        if (categories.success) this.categories = categories.data;
        if (tags.success) this.tags = tags.data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; }
    });
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  createUser() {
    if (!this.newUser.username || !this.newUser.password) { this.error = 'Usuario y contraseña requeridos'; return; }
    this.saving = true;
    this.auth.createUser(this.newUser).subscribe({
      next: res => {
        this.saving = false;
        if (res.success) {
          this.showSuccess('Usuario creado');
          this.newUser = { username: '', password: '', role: 'viewer' };
          this.showAddUser = false;
          this.auth.getUsers().subscribe(r => { if (r.success) this.users = r.data; this.cdr.detectChanges(); });
        } else { this.error = res.error; this.cdr.detectChanges(); }
      },
      error: err => { this.saving = false; this.error = err.error?.error || 'Error al crear usuario'; this.cdr.detectChanges(); }
    });
  }

  startEditUser(user: User) {
    this.editingUser = user;
    this.editUserPatch = { username: user.username, role: user.role, password: '' };
    this.editUserPatchConfirm = '';
    this.editUserShowPw = false;
  }

  saveEditUser() {
    if (!this.editingUser) return;
    if (this.editUserPatch.password && this.editUserPatch.password !== this.editUserPatchConfirm) {
      this.error = 'Las contraseñas no coinciden';
      return;
    }
    this.saving = true;
    const patch: any = { role: this.editUserPatch.role };
    if (this.editUserPatch.username !== this.editingUser.username) patch.username = this.editUserPatch.username;
    if (this.editUserPatch.password) patch.password = this.editUserPatch.password;

    this.auth.updateUser(this.editingUser.id, patch).subscribe({
      next: res => {
        this.saving = false;
        if (res.success) {
          this.showSuccess('Usuario actualizado');
          this.editingUser = null;
          this.editUserPatchConfirm = '';
          this.editUserShowPw = false;
          this.auth.getUsers().subscribe(r => { if (r.success) this.users = r.data; this.cdr.detectChanges(); });
        } else { this.error = res.error; this.cdr.detectChanges(); }
      },
      error: err => { this.saving = false; this.error = err.error?.error || 'Error al actualizar'; this.cdr.detectChanges(); }
    });
  }

  deleteUser(user: User) {
    if (!confirm(`¿Eliminar el usuario "${user.username}"?`)) return;
    this.auth.deleteUser(user.id).subscribe({
      next: res => {
        if (res.success) { this.users = this.users.filter(u => u.id !== user.id); this.showSuccess('Usuario eliminado'); }
        else this.error = res.error;
      }
    });
  }

  // ── Locations ─────────────────────────────────────────────────────────────

  createLocation() {
    if (!this.newLocation.name || !this.newLocation.base_path) { this.error = 'Nombre y ruta requeridos'; return; }
    this.saving = true;
    this.fs.createLocation(this.newLocation).subscribe({
      next: res => {
        this.saving = false;
        if (res.success) {
          this.showSuccess('Ubicación creada');
          this.newLocation = { name: '', base_path: '', storage_type: 'local', description: '' };
          this.showAddLocation = false;
          this.fs.getLocations().subscribe(r => { if (r.success) this.locations = r.data; });
        } else { this.error = res.error; }
      },
      error: err => { this.saving = false; this.error = err.error?.error || 'Error al crear ubicación'; }
    });
  }

  deleteLocation(loc: StorageLocation) {
    if (!confirm(`¿Eliminar la ubicación "${loc.name}"?`)) return;
    this.fs.deleteLocation(loc.id).subscribe({
      next: res => {
        if (res.success) { this.locations = this.locations.filter(l => l.id !== loc.id); this.showSuccess('Ubicación eliminada'); }
        else this.error = res.error;
      }
    });
  }

  // ── Categories ────────────────────────────────────────────────────────────

  createCategory() {
    if (!this.newCategory.name) { this.error = 'Nombre requerido'; return; }
    this.saving = true;
    this.fs.createCategory(this.newCategory).subscribe({
      next: res => {
        this.saving = false;
        if (res.success) {
          this.showSuccess('Categoría creada');
          this.newCategory = { name: '', description: '', color: '#6366f1', icon: 'folder' };
          this.showAddCategory = false;
          this.fs.getCategories().subscribe(r => { if (r.success) this.categories = r.data; });
        } else { this.error = res.error; }
      },
      error: err => { this.saving = false; this.error = err.error?.error || 'Error'; }
    });
  }

  deleteCategory(cat: Category) {
    if (!confirm(`¿Eliminar "${cat.name}"?`)) return;
    this.fs.deleteCategory(cat.id).subscribe({
      next: res => {
        if (res.success) { this.categories = this.categories.filter(c => c.id !== cat.id); this.showSuccess('Categoría eliminada'); }
      }
    });
  }

  deleteTag(tag: Tag) {
    if (!confirm(`¿Eliminar la etiqueta "${tag.name}"?`)) return;
    this.fs.deleteTag(tag.id).subscribe({
      next: res => {
        if (res.success) { this.tags = this.tags.filter(t => t.id !== tag.id); this.showSuccess('Etiqueta eliminada'); }
        else this.error = res.error;
      }
    });
  }

  // ── Updates ───────────────────────────────────────────────────────────────

  loadUpdatePackages() {
    this.fs.getUpdatePackages().subscribe({
      next: res => {
        if (res.success) {
          this.updatePackages = res.packages;
          this.version = res.currentVersion;
        }
        this.cdr.detectChanges();
      }
    });
  }

  checkUpdates() {
    this.checkingUpdates = true;
    this.fs.checkUpdates().subscribe({
      next: res => {
        this.checkingUpdates = false;
        if (res.success) {
          this.updateCheckResult = res;
          this.updatePackages = res.packages || [];
          this.version = res.currentVersion;
        }
        this.cdr.detectChanges();
      },
      error: () => { this.checkingUpdates = false; this.error = 'No se pudo verificar actualizaciones'; this.cdr.detectChanges(); }
    });
  }

  onPkgFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.zip')) { this.error = 'Solo se permiten archivos .zip'; return; }
    this.uploadingPkg = true;
    this.fs.uploadUpdatePackage(file).subscribe({
      next: res => {
        this.uploadingPkg = false;
        if (res.success) {
          this.showSuccess(`Paquete "${res.filename}" subido`);
          this.updatePackages = res.packages || [];
        } else {
          this.error = res.error || 'Error al subir paquete';
        }
        this.cdr.detectChanges();
      },
      error: err => { this.uploadingPkg = false; this.error = err.error?.error || 'Error al subir'; this.cdr.detectChanges(); }
    });
  }

  applyPackage(filename: string) {
    if (!confirm(`¿Aplicar el paquete "${filename}"? La aplicación se reiniciará.`)) return;
    this.applyingPkg = filename;
    this.fs.applyUpdatePackage(filename).subscribe({
      next: res => {
        if (res.success) {
          this.showSuccess('Actualización iniciada. El servidor se reiniciará en ~3 segundos.');
          this.updateStatus = { status: 'updating', message: 'Aplicando actualización...' };
        } else {
          this.error = res.error;
        }
        this.applyingPkg = '';
        this.cdr.detectChanges();
      },
      error: err => { this.applyingPkg = ''; this.error = err.error?.error || 'Error al aplicar'; this.cdr.detectChanges(); }
    });
  }

  downloadRemotePackage(url: string, filename: string) {
    this.fs.downloadRemotePackage(url, filename).subscribe({
      next: res => {
        if (res.success) this.showSuccess('Descarga iniciada. Aparecerá en la lista en unos momentos.');
        else this.error = res.error;
        this.cdr.detectChanges();
      },
      error: () => { this.error = 'Error al iniciar descarga'; this.cdr.detectChanges(); }
    });
  }

  // ── Filesystem browser ────────────────────────────────────────────────────

  openFsBrowser() { this.showFsBrowser = true; }
  onFsBrowserSelected(path: string) { this.newLocation.base_path = path; this.showFsBrowser = false; }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private showSuccess(msg: string) {
    this.success = msg; this.error = '';
    setTimeout(() => { this.success = ''; this.cdr.detectChanges(); }, 3000);
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024, sizes = ['B','KB','MB','GB','TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  get visibleTabs() {
    return this.TABS.filter(t => {
      if (t.id === 'system') return this.auth.hasPermission('canPerformUpdates');
      return true;
    });
  }
}
