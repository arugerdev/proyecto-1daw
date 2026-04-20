import { Component, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileService } from '../../services/file.service';
import { IconComponent } from '../../components/icon/icon.component';

interface ImportResult {
  imported: number;
  total: number;
  valid: number;
  errors: string[];
}

interface AnalyzeResponse {
  success: boolean;
  headers: string[];
  suggested: Record<string, string | null>;
  preview: Array<Record<string, any>>;
  total: number;
  supportedFields: string[];
  requiredFields: string[];
}

type WizardStep = 'file' | 'map' | 'verify' | 'result';

// Human-friendly labels for canonical fields
const FIELD_LABELS: Record<string, string> = {
  title:            'Título',
  file_path:        'Ruta del archivo',
  description:      'Descripción',
  publication_year: 'Año de publicación',
  category:         'Categoría',
  tags:             'Etiquetas',
  author:           'Autor'
};

const FIELD_HINTS: Record<string, string> = {
  title:            'Nombre visible del contenido',
  file_path:        'Ruta relativa o absoluta al archivo en el servidor',
  description:      'Texto libre que se mostrará como descripción',
  publication_year: 'Año (número entero, p. ej. 1995)',
  category:         'Se creará automáticamente si no existe',
  tags:             'Separadas por coma, punto y coma o pipe',
  author:           'Persona o entidad creadora'
};

@Component({
  selector: 'app-csv-import-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="modal-overlay" (click)="close.emit()">
      <div class="modal-box max-w-3xl" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div>
            <h2 class="text-lg font-semibold text-surface-100">Importar desde CSV</h2>
            <p class="text-sm text-surface-500">
              <ng-container [ngSwitch]="step">
                <span *ngSwitchCase="'file'">Paso 1 de 3 — Selecciona el archivo CSV</span>
                <span *ngSwitchCase="'map'">Paso 2 de 3 — Asigna las columnas a los campos</span>
                <span *ngSwitchCase="'verify'">Paso 3 de 3 — Verifica y confirma la importación</span>
                <span *ngSwitchCase="'result'">Importación completada</span>
              </ng-container>
            </p>
          </div>
          <button (click)="close.emit()" class="btn-ghost btn-sm p-1.5" [disabled]="importing || analyzing">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Step indicator -->
        <div *ngIf="step !== 'result'" class="px-5 pt-4">
          <div class="flex items-center gap-2">
            <div *ngFor="let s of stepsOrder; let i = index" class="flex items-center flex-1">
              <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 shrink-0"
                [class.bg-primary-500]="isStepActiveOrDone(s)"
                [class.border-primary-500]="isStepActiveOrDone(s)"
                [class.text-white]="isStepActiveOrDone(s)"
                [class.border-surface-700]="!isStepActiveOrDone(s)"
                [class.text-surface-500]="!isStepActiveOrDone(s)">
                {{ i + 1 }}
              </div>
              <div *ngIf="i < stepsOrder.length - 1" class="flex-1 h-0.5 mx-2"
                [class.bg-primary-500]="isStepDone(s)"
                [class.bg-surface-700]="!isStepDone(s)"></div>
            </div>
          </div>
        </div>

        <div class="p-5 space-y-4">

          <!-- ═══════════════════════════════════════════════════════════════
               STEP 1: FILE SELECTION
               ══════════════════════════════════════════════════════════════ -->
          <ng-container *ngIf="step === 'file'">
            <div class="bg-surface-900/50 rounded-xl p-4 border border-surface-700">
              <p class="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Formato del CSV</p>
              <p class="text-sm text-surface-400">
                Sube cualquier CSV con una fila de cabeceras. En el siguiente paso podrás
                asignar tus columnas a los campos de la aplicación, aunque tengan nombres distintos.
              </p>
              <div class="mt-3 text-xs text-surface-500 space-y-1">
                <p>Campos soportados:
                  <span class="text-surface-300" *ngFor="let f of supportedFields; let last = last">
                    {{ labelFor(f) }}<span *ngIf="requiredFields.includes(f)" class="text-red-400">*</span><span *ngIf="!last">, </span>
                  </span>
                </p>
                <p class="text-surface-600 mt-1"><span class="text-red-400">*</span> Campos obligatorios</p>
              </div>
            </div>

            <div class="drop-zone" [class.dragover]="dragging"
              (dragover)="$event.preventDefault(); dragging = true"
              (dragleave)="dragging = false"
              (drop)="onDrop($event)"
              (click)="fileInput.click()">
              <div *ngIf="!selectedFile">
                <app-icon name="table" class="w-12 h-12 mx-auto mb-3 text-primary-400"></app-icon>
                <p class="text-surface-300 font-medium">Selecciona un archivo CSV</p>
                <p class="text-surface-500 text-sm mt-1">o arrástralo aquí</p>
                <p class="text-surface-600 text-xs mt-2">Codificación UTF-8 o UTF-8 BOM</p>
              </div>
              <div *ngIf="selectedFile" class="flex items-center gap-3">
                <app-icon name="table" class="w-9 h-9 text-primary-400 shrink-0"></app-icon>
                <div class="text-left">
                  <p class="text-surface-100 font-medium">{{ selectedFile.name }}</p>
                  <p class="text-surface-500 text-sm">{{ formatBytes(selectedFile.size) }}</p>
                </div>
              </div>
            </div>
            <input #fileInput type="file" accept=".csv,.tsv,text/csv" class="hidden" (change)="onFileSelected($event)"/>

            <div *ngIf="analyzing" class="text-center py-2 text-surface-400 text-sm">
              <svg class="w-5 h-5 animate-spin inline mr-2 text-primary-500" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Analizando cabeceras del CSV...
            </div>
          </ng-container>

          <!-- ═══════════════════════════════════════════════════════════════
               STEP 2: COLUMN MAPPING
               ══════════════════════════════════════════════════════════════ -->
          <ng-container *ngIf="step === 'map' && analysis">
            <div class="bg-surface-900/50 rounded-xl p-3 border border-surface-700 text-sm text-surface-400">
              <p>
                Encontramos <strong class="text-surface-200">{{ analysis.headers.length }}</strong> columnas
                y <strong class="text-surface-200">{{ analysis.total }}</strong> filas.
                Asigna cada campo de la aplicación a la columna correspondiente de tu CSV.
                Los campos marcados con <span class="text-red-400">*</span> son obligatorios.
              </p>
              <p *ngIf="unmappedRequired().length > 0" class="mt-2 text-amber-400 text-xs flex items-start gap-1.5">
                <app-icon name="alert-triangle" class="w-3.5 h-3.5 shrink-0 mt-0.5"></app-icon>
                <span>
                  No pudimos detectar automáticamente:
                  <strong>{{ unmappedRequired().map(labelFor).join(', ') }}</strong>.
                  Selecciónalas manualmente abajo.
                </span>
              </p>
              <p *ngIf="unmappedRequired().length === 0" class="mt-2 text-emerald-400 text-xs flex items-start gap-1.5">
                <app-icon name="check-circle" class="w-3.5 h-3.5 shrink-0 mt-0.5"></app-icon>
                <span>Todas las columnas obligatorias fueron detectadas automáticamente. Revisa y ajusta si es necesario.</span>
              </p>
            </div>

            <div class="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              <div *ngFor="let field of supportedFields"
                class="flex items-center gap-3 p-3 rounded-lg border transition-colors"
                [class.bg-red-600/5]="requiredFields.includes(field) && !mapping[field]"
                [class.border-red-600/30]="requiredFields.includes(field) && !mapping[field]"
                [class.bg-surface-900/30]="!(requiredFields.includes(field) && !mapping[field])"
                [class.border-surface-700]="!(requiredFields.includes(field) && !mapping[field])">

                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-surface-200">
                    {{ labelFor(field) }}
                    <span *ngIf="requiredFields.includes(field)" class="text-red-400 ml-0.5">*</span>
                    <span *ngIf="wasAutoDetected(field)" class="ml-2 text-xs text-emerald-400 font-normal inline-flex items-center gap-0.5">
                      <app-icon name="check" class="w-3 h-3"></app-icon> autodetectado
                    </span>
                  </p>
                  <p class="text-xs text-surface-500 truncate">{{ hintFor(field) }}</p>
                </div>

                <svg class="w-4 h-4 text-surface-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                </svg>

                <select [(ngModel)]="mapping[field]" [name]="'map_' + field"
                  class="input py-1.5 text-sm w-48 shrink-0"
                  (ngModelChange)="onMappingChange()">
                  <option [ngValue]="null">
                    {{ requiredFields.includes(field) ? '— Selecciona columna —' : '— Ignorar —' }}
                  </option>
                  <option *ngFor="let h of analysis.headers" [ngValue]="h">{{ h }}</option>
                </select>
              </div>
            </div>

            <!-- Mini preview of the first row with current mapping -->
            <div *ngIf="analysis.preview.length > 0" class="bg-surface-900/50 rounded-xl p-3 border border-surface-700">
              <p class="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">
                Vista previa — primera fila
              </p>
              <div class="space-y-1 text-xs">
                <div *ngFor="let field of supportedFields" class="flex gap-2">
                  <span class="text-surface-500 w-32 shrink-0">{{ labelFor(field) }}:</span>
                  <span class="text-surface-300 font-mono truncate" *ngIf="mapping[field]">
                    {{ analysis.preview[0][mapping[field]!] || '(vacío)' }}
                  </span>
                  <span class="text-surface-600 italic" *ngIf="!mapping[field]">(sin asignar)</span>
                </div>
              </div>
            </div>
          </ng-container>

          <!-- ═══════════════════════════════════════════════════════════════
               STEP 3: VERIFICATION SUMMARY
               ══════════════════════════════════════════════════════════════ -->
          <ng-container *ngIf="step === 'verify' && analysis">
            <div class="bg-surface-900/50 rounded-xl p-4 border border-surface-700">
              <p class="text-sm text-surface-300">
                Revisa el resumen de la importación antes de continuar.
                Se procesarán <strong class="text-surface-100">{{ analysis.total }}</strong>
                {{ analysis.total === 1 ? 'fila' : 'filas' }}.
              </p>
            </div>

            <div>
              <p class="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">
                Asignación de columnas
              </p>
              <div class="divide-y divide-surface-700/50 rounded-xl border border-surface-700 overflow-hidden">
                <div *ngFor="let field of supportedFields"
                  class="flex items-center gap-3 px-4 py-2.5"
                  [class.bg-surface-900/30]="mapping[field]"
                  [class.bg-surface-900/10]="!mapping[field]">

                  <span class="text-sm font-medium text-surface-200 w-40 shrink-0">
                    {{ labelFor(field) }}
                    <span *ngIf="requiredFields.includes(field)" class="text-red-400">*</span>
                  </span>

                  <svg class="w-3.5 h-3.5 text-surface-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                  </svg>

                  <span *ngIf="mapping[field]"
                    class="text-sm font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 truncate">
                    {{ mapping[field] }}
                  </span>
                  <span *ngIf="!mapping[field]" class="text-sm text-surface-500 italic">
                    {{ requiredFields.includes(field) ? '(falta)' : 'no se importará' }}
                  </span>
                </div>
              </div>
            </div>

            <div *ngIf="analysis.preview.length > 0">
              <p class="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">
                Muestra de datos ({{ analysis.preview.length }} {{ analysis.preview.length === 1 ? 'fila' : 'filas' }})
              </p>
              <div class="rounded-xl border border-surface-700 overflow-hidden overflow-x-auto">
                <table class="w-full text-xs">
                  <thead class="bg-surface-900/50">
                    <tr>
                      <th *ngFor="let field of mappedFields()"
                        class="text-left px-3 py-2 text-surface-400 font-medium whitespace-nowrap">
                        {{ labelFor(field) }}
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-surface-700/50">
                    <tr *ngFor="let row of analysis.preview">
                      <td *ngFor="let field of mappedFields()"
                        class="px-3 py-2 text-surface-300 font-mono truncate max-w-[12rem]">
                        {{ row[mapping[field]!] || '—' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </ng-container>

          <!-- ═══════════════════════════════════════════════════════════════
               IMPORTING SPINNER
               ══════════════════════════════════════════════════════════════ -->
          <div *ngIf="importing" class="text-center py-4">
            <svg class="w-8 h-8 animate-spin text-primary-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p class="text-surface-400">Importando registros...</p>
          </div>

          <!-- ═══════════════════════════════════════════════════════════════
               STEP 4: RESULT
               ══════════════════════════════════════════════════════════════ -->
          <ng-container *ngIf="step === 'result' && result">
            <div class="flex items-center gap-3 p-4 rounded-xl"
              [class.bg-emerald-600/10]="result.imported > 0"
              [class.border-emerald-600/30]="result.imported > 0"
              [class.bg-red-600/10]="result.imported === 0"
              [class.border-red-600/30]="result.imported === 0"
              [class.border]="true">
              <app-icon [name]="result.imported > 0 ? 'check-circle' : 'x-circle'"
                class="w-8 h-8 shrink-0"
                [class.text-emerald-400]="result.imported > 0"
                [class.text-red-400]="result.imported === 0"></app-icon>
              <div>
                <p class="font-semibold text-surface-100">
                  {{ result.imported }} de {{ result.total }} importados
                </p>
                <p class="text-sm text-surface-400">{{ result.valid }} filas válidas procesadas</p>
              </div>
            </div>

            <div *ngIf="result.errors.length" class="bg-surface-900/50 rounded-xl p-3 max-h-40 overflow-y-auto">
              <p class="text-xs font-semibold text-amber-400 mb-2">Advertencias / Errores</p>
              <div *ngFor="let err of result.errors"
                class="text-xs text-surface-400 py-0.5 border-b border-surface-700/50 last:border-0">
                {{ err }}
              </div>
            </div>
          </ng-container>

          <!-- Error -->
          <div *ngIf="error" class="p-3 rounded-lg bg-red-600/10 border border-red-600/30 text-red-400 text-sm">
            {{ error }}
          </div>

          <!-- ═══════════════════════════════════════════════════════════════
               ACTION BUTTONS
               ══════════════════════════════════════════════════════════════ -->
          <div class="flex justify-between items-center gap-3 pt-2 border-t border-surface-700">
            <button *ngIf="step !== 'result' && step !== 'file'"
              (click)="goBack()" class="btn-secondary inline-flex items-center gap-1.5"
              [disabled]="importing || analyzing">
              <app-icon name="arrow-left" class="w-4 h-4"></app-icon>
              Atrás
            </button>
            <div *ngIf="step === 'file' || step === 'result'"></div>

            <div class="flex gap-3">
              <button *ngIf="step !== 'result'" (click)="close.emit()" class="btn-ghost"
                [disabled]="importing || analyzing">Cancelar</button>

              <!-- Step 1: next -->
              <button *ngIf="step === 'file'" (click)="onAnalyze()" class="btn-primary inline-flex items-center gap-1.5"
                [disabled]="analyzing || !selectedFile">
                <svg *ngIf="analyzing" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Continuar
                <app-icon name="arrow-right" class="w-4 h-4"></app-icon>
              </button>

              <!-- Step 2: next -->
              <button *ngIf="step === 'map'" (click)="goToVerify()" class="btn-primary inline-flex items-center gap-1.5"
                [disabled]="unmappedRequired().length > 0">
                Continuar
                <app-icon name="arrow-right" class="w-4 h-4"></app-icon>
              </button>

              <!-- Step 3: import -->
              <button *ngIf="step === 'verify'" (click)="onImport()" class="btn-primary" [disabled]="importing">
                <svg *ngIf="importing" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Confirmar e importar
              </button>

              <!-- Step 4: finalize -->
              <button *ngIf="step === 'result' && result && result.imported > 0"
                (click)="imported.emit()" class="btn-primary">
                Finalizar
              </button>
              <button *ngIf="step === 'result'" (click)="reset()" class="btn-secondary">
                Importar otro
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class CsvImportModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() imported = new EventEmitter<void>();

  step: WizardStep = 'file';
  stepsOrder: WizardStep[] = ['file', 'map', 'verify'];

  selectedFile: File | null = null;
  dragging = false;
  analyzing = false;
  importing = false;
  error = '';

  analysis: AnalyzeResponse | null = null;
  mapping: Record<string, string | null> = {};
  suggested: Record<string, string | null> = {};
  supportedFields: string[] = [];
  requiredFields: string[] = [];

  result: ImportResult | null = null;

  constructor(private fs: FileService, private cdr: ChangeDetectorRef) {}

  // ── Step helpers ──────────────────────────────────────────────────────────

  isStepActiveOrDone(s: WizardStep): boolean {
    const idx = this.stepsOrder.indexOf(s);
    const cur = this.stepsOrder.indexOf(this.step);
    return idx <= cur;
  }

  isStepDone(s: WizardStep): boolean {
    const idx = this.stepsOrder.indexOf(s);
    const cur = this.stepsOrder.indexOf(this.step);
    return idx < cur;
  }

  // ── File step ─────────────────────────────────────────────────────────────

  onDrop(e: DragEvent) {
    e.preventDefault(); this.dragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) { this.selectedFile = file; this.error = ''; }
  }

  onFileSelected(e: Event) {
    this.selectedFile = (e.target as HTMLInputElement).files?.[0] || null;
    this.error = '';
  }

  onAnalyze() {
    if (!this.selectedFile) return;
    this.analyzing = true; this.error = '';

    this.fs.analyzeCSV(this.selectedFile).subscribe({
      next: (res: AnalyzeResponse) => {
        this.analyzing = false;
        this.analysis = res;
        this.supportedFields = res.supportedFields || [];
        this.requiredFields = res.requiredFields || [];
        this.suggested = { ...res.suggested };
        this.mapping = { ...res.suggested };
        // Make sure every supported field is an explicit key (so ngModel binding works)
        for (const f of this.supportedFields) {
          if (!(f in this.mapping)) this.mapping[f] = null;
        }
        this.step = 'map';
        this.cdr.detectChanges();
      },
      error: err => {
        this.analyzing = false;
        this.error = err.error?.error || 'Error al analizar el CSV';
        this.cdr.detectChanges();
      }
    });
  }

  // ── Mapping step ──────────────────────────────────────────────────────────

  onMappingChange() {
    // Force CD so the preview updates instantly
    this.cdr.detectChanges();
  }

  wasAutoDetected(field: string): boolean {
    return !!this.suggested[field] && this.mapping[field] === this.suggested[field];
  }

  unmappedRequired(): string[] {
    return this.requiredFields.filter(f => !this.mapping[f]);
  }

  mappedFields(): string[] {
    return this.supportedFields.filter(f => !!this.mapping[f]);
  }

  goToVerify() {
    if (this.unmappedRequired().length > 0) return;
    this.step = 'verify';
  }

  // ── Verify / import ───────────────────────────────────────────────────────

  onImport() {
    if (!this.selectedFile) return;
    this.importing = true; this.error = '';

    // Build a clean mapping: only include fields with a value
    const clean: Record<string, string | null> = {};
    for (const f of this.supportedFields) {
      clean[f] = this.mapping[f] || null;
    }

    this.fs.importCSV(this.selectedFile, clean).subscribe({
      next: res => {
        this.importing = false;
        this.result = {
          imported: res.imported,
          total: res.total,
          valid: res.valid,
          errors: res.errors || []
        };
        this.step = 'result';
        this.cdr.detectChanges();
      },
      error: err => {
        this.importing = false;
        this.error = err.error?.error || 'Error al importar el CSV';
        this.cdr.detectChanges();
      }
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  goBack() {
    if (this.step === 'verify') this.step = 'map';
    else if (this.step === 'map') {
      this.step = 'file';
      this.analysis = null;
    }
  }

  reset() {
    this.step = 'file';
    this.selectedFile = null;
    this.analysis = null;
    this.mapping = {};
    this.suggested = {};
    this.result = null;
    this.error = '';
    this.cdr.detectChanges();
  }

  // ── Labels ────────────────────────────────────────────────────────────────

  labelFor = (field: string): string => FIELD_LABELS[field] || field;
  hintFor = (field: string): string => FIELD_HINTS[field] || '';

  // ── Utils ─────────────────────────────────────────────────────────────────

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024, sizes = ['B','KB','MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }
}
