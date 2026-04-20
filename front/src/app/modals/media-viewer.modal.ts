import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl, SafeHtml } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { MediaItem } from '../models/file.model';
import { FileService } from '../../services/file.service';

@Component({
  selector: 'app-media-viewer-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" (click)="close.emit()">
      <div class="modal-box max-w-5xl" (click)="$event.stopPropagation()" style="max-height:92vh">

        <!-- Header -->
        <div class="modal-header">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-lg">{{ kindEmoji }}</span>
            <div class="min-w-0">
              <h2 class="text-base font-semibold text-surface-100 truncate">{{ file.title }}</h2>
              <p class="text-xs text-surface-500">
                {{ file.filename }}
                <span *ngIf="file.file_size_formatted"> · {{ file.file_size_formatted }}</span>
                <span *ngIf="file.publication_year"> · {{ file.publication_year }}</span>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button *ngIf="canDownload" (click)="download.emit(file)" class="btn-secondary btn-sm">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Descargar
            </button>
            <button *ngIf="canEdit" (click)="edit.emit(file)" class="btn-secondary btn-sm">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              Editar
            </button>
            <button (click)="close.emit()" class="btn-ghost btn-sm p-1.5">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Media area -->
        <div class="p-4 overflow-y-auto" style="max-height:calc(92vh - 64px)">

          <!-- ── VIDEO ──────────────────────────────────────────────────────── -->
          <div *ngIf="file.media_kind === 'video'" class="rounded-xl overflow-hidden bg-black">
            <video [src]="mediaUrl" controls class="w-full max-h-[55vh]" preload="metadata"
              [attr.controlsList]="!canDownload ? 'nodownload noremoteplayback' : null"
              [attr.disableremoteplayback]="!canDownload ? '' : null">
              Tu navegador no soporta la reproducción de vídeo.
            </video>
            <p *ngIf="!canDownload" class="text-center text-xs text-surface-600 py-1">
              Vista en línea — sin permiso de descarga
            </p>
          </div>

          <!-- ── AUDIO ──────────────────────────────────────────────────────── -->
          <div *ngIf="file.media_kind === 'audio'" class="flex flex-col items-center gap-6 py-8">
            <div class="w-24 h-24 bg-emerald-600/20 rounded-2xl flex items-center justify-center text-5xl">🎵</div>
            <audio [src]="mediaUrl" controls class="w-full max-w-lg"
              [attr.controlsList]="!canDownload ? 'nodownload' : null">
              Tu navegador no soporta la reproducción de audio.
            </audio>
            <p *ngIf="!canDownload" class="text-xs text-surface-600">
              Vista en línea — sin permiso de descarga
            </p>
          </div>

          <!-- ── IMAGE ──────────────────────────────────────────────────────── -->
          <div *ngIf="file.media_kind === 'image'" class="flex items-center justify-center bg-black/30 rounded-xl overflow-hidden">
            <img [src]="mediaUrl" [alt]="file.title" class="max-w-full max-h-[60vh] object-contain rounded-xl"/>
          </div>

          <!-- ── PDF ────────────────────────────────────────────────────────── -->
          <div *ngIf="isPdf" class="rounded-xl overflow-hidden">
            <iframe [src]="safeUrl" class="w-full rounded-xl" style="height:62vh;border:none;" title="PDF"></iframe>
          </div>

          <!-- ── HTML file ──────────────────────────────────────────────────── -->
          <div *ngIf="isHtmlFile">
            <div *ngIf="textLoading" class="flex items-center justify-center py-16">
              <svg class="w-6 h-6 animate-spin text-primary-400" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
            <div *ngIf="!textLoading && safeUrl" class="rounded-xl overflow-hidden border border-surface-700">
              <iframe [src]="safeUrl" sandbox="allow-scripts allow-same-origin"
                class="w-full bg-white" style="height:62vh;border:none;" title="HTML preview"></iframe>
            </div>
            <div *ngIf="textError" class="text-center py-8 text-red-400 text-sm">{{ textError }}</div>
          </div>

          <!-- ── MARKDOWN ───────────────────────────────────────────────────── -->
          <div *ngIf="isMarkdown && !isHtmlFile">
            <div *ngIf="textLoading" class="flex items-center justify-center py-16">
              <svg class="w-6 h-6 animate-spin text-primary-400" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
            <div *ngIf="!textLoading && renderedMarkdown"
              class="bg-surface-900 rounded-xl p-5 overflow-auto"
              style="max-height:62vh"
              [innerHTML]="renderedMarkdown">
            </div>
            <div *ngIf="textError" class="text-center py-8 text-red-400 text-sm">{{ textError }}</div>
            <p *ngIf="textTruncated && !textLoading" class="text-xs text-surface-600 text-center mt-2">
              — Mostrando los primeros 20 000 caracteres —
            </p>
          </div>

          <!-- ── PLAIN TEXT (txt, json, xml, csv, js, ts, css, etc.) ──────── -->
          <div *ngIf="file.media_kind === 'text' && !isMarkdown && !isHtmlFile">
            <div *ngIf="textLoading" class="flex items-center justify-center py-16">
              <svg class="w-6 h-6 animate-spin text-primary-400" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
            <div *ngIf="!textLoading && !textError && textContent"
              class="bg-surface-900 rounded-xl overflow-auto"
              style="max-height:62vh">
              <pre class="p-4 text-xs text-surface-300 font-mono leading-relaxed whitespace-pre-wrap break-words">{{ textContent }}</pre>
            </div>
            <div *ngIf="textError && !textLoading" class="text-center py-8 text-red-400 text-sm">{{ textError }}</div>
            <p *ngIf="textTruncated && !textLoading" class="text-xs text-surface-600 text-center mt-2">
              — Mostrando los primeros 20 000 caracteres —
            </p>
          </div>

          <!-- ── BINARY DOCUMENTS (docx, xlsx, odt, ppt…) ─────────────────── -->
          <div *ngIf="file.media_kind === 'document' && !isPdf" class="rounded-xl bg-surface-900 p-6 text-center py-12">
            <div class="text-5xl mb-4">📄</div>
            <p class="text-surface-300 font-medium mb-1">{{ file.title }}</p>
            <p class="text-surface-500 text-sm mb-4">
              Vista previa no disponible para archivos {{ file.file_extension?.toUpperCase() }}.
            </p>
            <button *ngIf="canDownload" (click)="download.emit(file)" class="btn-primary">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Descargar para abrir
            </button>
            <p *ngIf="!canDownload" class="text-surface-600 text-xs">Sin permiso de descarga.</p>
          </div>

          <!-- ── OTHER ──────────────────────────────────────────────────────── -->
          <div *ngIf="file.media_kind === 'other'" class="text-center py-12">
            <div class="text-5xl mb-4">📦</div>
            <p class="text-surface-400 mb-4">No hay vista previa disponible.</p>
            <button *ngIf="canDownload" (click)="download.emit(file)" class="btn-primary">Descargar</button>
          </div>

          <!-- ── METADATA ────────────────────────────────────────────────────── -->
          <div class="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div *ngIf="file.description" class="col-span-full bg-surface-900/50 rounded-xl p-3">
              <p class="text-xs text-surface-500 mb-1">Descripción</p>
              <p class="text-surface-300">{{ file.description }}</p>
            </div>

            <div *ngIf="file.category_name" class="bg-surface-900/50 rounded-xl p-3">
              <p class="text-xs text-surface-500 mb-1">Categoría</p>
              <span class="text-sm font-medium px-2 py-0.5 rounded"
                [style.background-color]="file.category_color + '20'"
                [style.color]="file.category_color">
                {{ file.category_name }}
              </span>
            </div>

            <div *ngIf="file.created_by_name" class="bg-surface-900/50 rounded-xl p-3">
              <p class="text-xs text-surface-500 mb-1">Subido por</p>
              <p class="text-surface-300">{{ file.created_by_name }}</p>
            </div>

            <div *ngIf="file.view_count !== undefined" class="bg-surface-900/50 rounded-xl p-3">
              <p class="text-xs text-surface-500 mb-1">Vistas</p>
              <p class="text-surface-300">{{ file.view_count | number }}</p>
            </div>

            <div *ngIf="file.created_at" class="bg-surface-900/50 rounded-xl p-3">
              <p class="text-xs text-surface-500 mb-1">Añadido</p>
              <p class="text-surface-300">{{ file.created_at | date:'dd/MM/yyyy' }}</p>
            </div>

            <div *ngIf="file.tags.length > 0" class="col-span-full bg-surface-900/50 rounded-xl p-3">
              <p class="text-xs text-surface-500 mb-2">Etiquetas</p>
              <div class="flex flex-wrap gap-1.5">
                <span *ngFor="let tag of file.tags" class="badge-neutral">{{ tag }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class MediaViewerModalComponent implements OnInit, OnDestroy {
  @Input() file!: MediaItem;
  @Input() canDownload = false;
  @Input() canEdit = false;
  @Output() close = new EventEmitter<void>();
  @Output() download = new EventEmitter<MediaItem>();
  @Output() edit = new EventEmitter<MediaItem>();

  mediaUrl = '';
  safeUrl?: SafeResourceUrl;

  // Text viewer state
  textContent = '';
  textLoading = false;
  textError = '';
  textTruncated = false;
  private htmlBlobUrl?: string;

  readonly kindEmojis: Record<string, string> = {
    video: '🎬', audio: '🎵', image: '🖼️', document: '📄', text: '📝', other: '📦'
  };

  get kindEmoji()  { return this.kindEmojis[this.file.media_kind] || '📦'; }
  get fileExt()    { return (this.file.file_extension || '').toLowerCase(); }
  get isPdf()      { return this.file.media_kind === 'document' && this.fileExt === 'pdf'; }
  get isMarkdown() { return this.file.media_kind === 'text' && ['md', 'markdown'].includes(this.fileExt); }
  get isHtmlFile() { return this.file.media_kind === 'text' && ['html', 'htm'].includes(this.fileExt); }
  get isTextViewable() {
    return this.file.media_kind === 'text'; // covers txt, md, json, xml, html, css, js, ts…
  }

  get renderedMarkdown(): SafeHtml {
    if (!this.textContent) return '';
    return this.sanitizer.bypassSecurityTrustHtml(this.renderMarkdown(this.textContent));
  }

  constructor(
    private fs: FileService,
    private sanitizer: DomSanitizer,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.mediaUrl = this.fs.getStreamUrl(this.file.id);

    if (this.isPdf) {
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.mediaUrl);
    }

    if (this.isTextViewable) {
      this.loadTextContent();
    }
  }

  ngOnDestroy() {
    if (this.htmlBlobUrl) URL.revokeObjectURL(this.htmlBlobUrl);
  }

  private loadTextContent() {
    this.textLoading = true;
    const LIMIT = 20000;
    this.http.get(this.fs.getTextPreviewUrl(this.file.id, LIMIT + 1), { responseType: 'text' }).subscribe({
      next: (text) => {
        this.textTruncated = text.length > LIMIT;
        this.textContent = text.slice(0, LIMIT);
        this.textLoading = false;

        if (this.isHtmlFile && this.textContent) {
          const blob = new Blob([this.textContent], { type: 'text/html; charset=utf-8' });
          this.htmlBlobUrl = URL.createObjectURL(blob);
          this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.htmlBlobUrl);
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.textError = 'No se pudo cargar el contenido del archivo.';
        this.textLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Basic Markdown → HTML renderer (no external library needed) ────────────
  private renderMarkdown(raw: string): string {
    // 1. Escape HTML entities (before any other transformation)
    let h = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 2. Fenced code blocks  ```lang\ncode```
    h = h.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, _lang, code) =>
      `<pre style="background:#0f172a;border:1px solid #334155;border-radius:6px;padding:12px;overflow-x:auto;margin:10px 0"><code style="font-family:monospace;font-size:0.83em;color:#e2e8f0;white-space:pre">${code.trim()}</code></pre>`
    );

    // 3. Inline code `code`
    h = h.replace(/`([^`\n]+)`/g,
      '<code style="background:#1e293b;padding:2px 6px;border-radius:3px;font-size:0.88em;color:#7dd3fc;font-family:monospace">$1</code>'
    );

    // 4. ATX headings
    h = h.replace(/^#### (.+)$/gm, '<h4 style="color:#f1f5f9;font-size:1em;font-weight:600;margin:12px 0 4px">$1</h4>');
    h = h.replace(/^### (.+)$/gm,  '<h3 style="color:#f1f5f9;font-size:1.1em;font-weight:700;margin:14px 0 6px">$1</h3>');
    h = h.replace(/^## (.+)$/gm,   '<h2 style="color:#f1f5f9;font-size:1.25em;font-weight:700;margin:18px 0 8px;border-bottom:1px solid #334155;padding-bottom:5px">$1</h2>');
    h = h.replace(/^# (.+)$/gm,    '<h1 style="color:#f1f5f9;font-size:1.5em;font-weight:800;margin:20px 0 10px;border-bottom:1px solid #475569;padding-bottom:8px">$1</h1>');

    // 5. Bold + italic
    h = h.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    h = h.replace(/\*\*(.+?)\*\*/g,     '<strong style="color:#f1f5f9">$1</strong>');
    h = h.replace(/__(.+?)__/g,         '<strong style="color:#f1f5f9">$1</strong>');
    h = h.replace(/\*([^*\n]+)\*/g,     '<em>$1</em>');
    h = h.replace(/_([^_\n]+)_/g,       '<em>$1</em>');

    // 6. Strikethrough
    h = h.replace(/~~(.+?)~~/g, '<del style="color:#64748b">$1</del>');

    // 7. Links + images
    h = h.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,
      '<img src="$2" alt="$1" style="max-width:100%;border-radius:4px;margin:4px 0"/>'
    );
    h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#7c3aed;text-decoration:underline">$1</a>'
    );

    // 8. Blockquotes (handle escaped &gt;)
    h = h.replace(/^&gt; (.+)$/gm,
      '<blockquote style="border-left:3px solid #7c3aed;padding:6px 12px;margin:8px 0;color:#94a3b8;font-style:italic;background:#1e293b;border-radius:0 4px 4px 0">$1</blockquote>'
    );

    // 9. Horizontal rules
    h = h.replace(/^(-{3,}|_{3,}|\*{3,})$/gm, '<hr style="border:none;border-top:1px solid #334155;margin:18px 0"/>');

    // 10. Lists (unordered)
    h = h.replace(/^[-*+] (.+)$/gm, '<li style="margin:3px 0;color:#cbd5e1;padding-left:4px">$1</li>');
    // Ordered lists
    h = h.replace(/^\d+\. (.+)$/gm, '<li style="margin:3px 0;color:#cbd5e1;padding-left:4px">$1</li>');
    // Wrap consecutive <li> in <ul>
    h = h.replace(/(<li[^>]*>[\s\S]*?<\/li>\n?)+/g,
      m => `<ul style="list-style:disc;padding-left:20px;margin:8px 0">${m}</ul>`
    );

    // 11. Paragraphs (double newline separation)
    h = h.split(/\n{2,}/).map(para => {
      para = para.trim();
      if (!para) return '';
      // Don't wrap block-level elements in <p>
      if (/^<(h[1-6]|pre|ul|ol|li|hr|blockquote|img)/.test(para)) return para;
      return `<p style="color:#cbd5e1;line-height:1.7;margin:0 0 12px">${para.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');

    return h;
  }

  @HostListener('document:keydown.escape') onEsc() { this.close.emit(); }
}
