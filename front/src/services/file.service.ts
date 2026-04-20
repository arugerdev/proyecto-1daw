import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MediaFilter, MediaItem, PaginatedResponse, Category, Tag, StorageLocation, Stats } from '../app/models/file.model';
import { LocalStorageService } from './localStorage.service';
import { environment } from '../environments/environment';

const API = (environment as any).API_URL;
// Key must match the USER_KEY constant in auth.service.ts
const USER_KEY = 'ec_user';

@Injectable({ providedIn: 'root' })
export class FileService {
  constructor(private http: HttpClient, private storage: LocalStorageService) {}

  /** Returns the JWT from local storage, or empty string if not logged in. */
  private getToken(): string {
    const user = this.storage.getItem<{ token?: string }>(USER_KEY);
    return user?.token ?? '';
  }

  /** Appends ?token= to a URL so browser-native elements (<video>, <img>) can authenticate. */
  private withToken(url: string): string {
    const token = this.getToken();
    return token ? `${url}?token=${encodeURIComponent(token)}` : url;
  }

  // ── Media ─────────────────────────────────────────────────────────────────

  getMedia(filter: MediaFilter = {}): Observable<PaginatedResponse<MediaItem>> {
    let params = new HttpParams();
    Object.entries(filter).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) params = params.set(k, String(v));
    });
    return this.http.get<PaginatedResponse<MediaItem>>(`${API}/media`, { params });
  }

  getMediaById(id: number): Observable<{ success: boolean; data: MediaItem }> {
    return this.http.get<any>(`${API}/media/${id}`);
  }

  uploadMedia(formData: FormData): Observable<any> {
    return this.http.post<any>(`${API}/media/upload`, formData);
  }

  registerExternal(data: {
    title: string;
    description?: string;
    file_path: string;
    publication_year?: number;
    category_id?: number;
    storage_location_id?: number;
    tags?: string[];
  }): Observable<any> {
    return this.http.post<any>(`${API}/media/register`, data);
  }

  updateMedia(id: number, data: Partial<MediaItem> & { tags?: string[] }): Observable<any> {
    return this.http.put<any>(`${API}/media/${id}`, data);
  }

  deleteMedia(id: number): Observable<any> {
    return this.http.delete<any>(`${API}/media/${id}`);
  }

  /** URL for forcing a file download (Content-Disposition: attachment). */
  getDownloadUrl(id: number): string {
    return this.withToken(`${API}/media/${id}/download`);
  }

  /** URL for inline streaming — use this for <video src> / <audio src>. */
  getStreamUrl(id: number): string {
    return this.withToken(`${API}/media/${id}/stream`);
  }

  /** URL for thumbnail images — use this for <img src>. */
  getThumbnailUrl(id: number): string {
    return this.withToken(`${API}/media/${id}/thumbnail`);
  }

  /** API URL for the text preview endpoint (auth handled by interceptor). */
  getTextPreviewUrl(id: number, limit = 20000): string {
    return `${API}/media/${id}/textpreview?limit=${limit}`;
  }

  /**
   * Inspect a CSV without importing. Returns the detected headers, an
   * auto-suggested mapping (canonical field → csv column), a few preview rows,
   * and the list of canonical fields the backend supports.
   */
  analyzeCSV(file: File): Observable<any> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<any>(`${API}/media/analyze-csv`, fd);
  }

  /**
   * Import a CSV. `mapping` is optional — if omitted the backend auto-detects
   * columns. When provided, it should be an object like:
   *   { title: 'nombre_archivo', file_path: 'ruta', description: null, ... }
   */
  importCSV(file: File, mapping?: Record<string, string | null>): Observable<any> {
    const fd = new FormData();
    fd.append('file', file);
    if (mapping) fd.append('mapping', JSON.stringify(mapping));
    return this.http.post<any>(`${API}/media/import-csv`, fd);
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  getStats(): Observable<{ success: boolean; data: Stats }> {
    return this.http.get<any>(`${API}/stats`);
  }

  // ── Categories ─────────────────────────────────────────────────────────────

  getCategories(): Observable<{ success: boolean; data: Category[] }> {
    return this.http.get<any>(`${API}/categories`);
  }

  createCategory(data: Partial<Category>): Observable<any> {
    return this.http.post<any>(`${API}/categories`, data);
  }

  updateCategory(id: number, data: Partial<Category>): Observable<any> {
    return this.http.put<any>(`${API}/categories/${id}`, data);
  }

  deleteCategory(id: number): Observable<any> {
    return this.http.delete<any>(`${API}/categories/${id}`);
  }

  // ── Tags ───────────────────────────────────────────────────────────────────

  getTags(): Observable<{ success: boolean; data: Tag[] }> {
    return this.http.get<any>(`${API}/tags`);
  }

  createTag(data: { name: string; color?: string }): Observable<any> {
    return this.http.post<any>(`${API}/tags`, data);
  }

  deleteTag(id: number): Observable<any> {
    return this.http.delete<any>(`${API}/tags/${id}`);
  }

  // ── Storage Locations ──────────────────────────────────────────────────────

  getLocations(): Observable<{ success: boolean; data: StorageLocation[] }> {
    return this.http.get<any>(`${API}/locations`);
  }

  createLocation(data: Partial<StorageLocation>): Observable<any> {
    return this.http.post<any>(`${API}/locations`, data);
  }

  updateLocation(id: number, data: Partial<StorageLocation>): Observable<any> {
    return this.http.put<any>(`${API}/locations/${id}`, data);
  }

  deleteLocation(id: number): Observable<any> {
    return this.http.delete<any>(`${API}/locations/${id}`);
  }

  browseFilesystem(path?: string): Observable<any> {
    const params = path ? new HttpParams().set('path', path) : new HttpParams();
    return this.http.get<any>(`${API}/locations/browse`, { params });
  }

  // ── System ─────────────────────────────────────────────────────────────────

  getVersion(): Observable<any> {
    return this.http.get<any>(`${API}/version`);
  }

  checkUpdates(): Observable<any> {
    return this.http.get<any>(`${API}/update/check`);
  }

  getUpdateStatus(): Observable<any> {
    return this.http.get<any>(`${API}/update/status`);
  }

  // Upload a release package
  uploadUpdatePackage(file: File): Observable<any> {
    const fd = new FormData();
    fd.append('package', file);
    return this.http.post<any>(`${API}/update/upload`, fd);
  }

  // List packages in the updates/ folder
  getUpdatePackages(): Observable<any> {
    return this.http.get<any>(`${API}/update/packages`);
  }

  // Apply a specific package
  applyUpdatePackage(filename: string): Observable<any> {
    return this.http.post<any>(`${API}/update/apply`, { filename });
  }

  // Download remote package
  downloadRemotePackage(url: string, filename: string): Observable<any> {
    return this.http.post<any>(`${API}/update/download`, { url, filename });
  }

  // Upload media with progress events
  uploadMediaWithProgress(formData: FormData): Observable<HttpEvent<any>> {
    return this.http.post<any>(`${API}/media/upload`, formData, {
      reportProgress: true,
      observe: 'events'
    });
  }
}
