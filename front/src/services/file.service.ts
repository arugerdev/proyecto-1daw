import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Stats, PaginatedResponse, MediaItem } from '../app/models/file.model';
import { SvgIcons } from '../app/utils/svg-icons';
import { environment } from '../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class FileService {

    private API = (environment as any).API_URL;

    constructor(private http: HttpClient) { }

    private getHeaders(): HttpHeaders {
        const token = localStorage.getItem('token');
        return new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
    }

    // ===========================
    // 📊 STATS
    // ===========================

    getStats(): Observable<{ success: boolean; stats: Stats }> {

        console.log('Obteniendo estadísticas desde:', this.API);
        console.log((environment as any));

        return this.http.get<{ success: boolean; stats: Stats }>(
            `${this.API}/stats`,
            { headers: this.getHeaders() }
        );
    }

    // ===========================
    // 📄 MEDIA PAGINADO
    // ===========================

    getMediaPaginated(
        page: number,
        limit: number,
        search: string = '',
        order: string,
        selectedType: number
    ): Observable<PaginatedResponse> {

        let params = new HttpParams()
            .set('page', page.toString())
            .set('limit', limit.toString());

        if (search) params = params.set('search', search);
        if (order) params = params.set('order', order);
        if (selectedType != 0) params = params.set('type', selectedType);

        return this.http.get<PaginatedResponse>(
            `${this.API}/files/paginated`,
            {
                headers: this.getHeaders(),
                params
            }
        );
    }

    getContentTypes() {
        return this.http.get<{
            success: boolean,
            data: { id: number; name: string }[]
        }>(`${this.API}/media-type`);
    }

    // ===========================
    // 📥 DESCARGAR
    // ===========================

    downloadMedia(id: number): Observable<Blob> {
        return this.http.get(
            `${this.API}/files/${id}/download`,
            {
                headers: this.getHeaders(),
                responseType: 'blob'
            }
        );
    }

    // ===========================
    // ❌ ELIMINAR
    // ===========================

    deleteMedia(id: number): Observable<{ success: boolean }> {
        return this.http.delete<{ success: boolean }>(
            `${this.API}/files/${id}`,
            { headers: this.getHeaders() }
        );
    }

    // ===========================
    // ✏ EDITAR METADATA
    // ===========================

    updateMedia(id: number, formData: FormData) {
        return this.http.put(
            `${this.API}/files/${id}`,
            formData,
            { headers: this.getHeaders() }
        );

    }

    // ===========================
    // 🎨 ICONOS POR CONTENT TYPE
    // ===========================

    getContentTypeIcon(filename: string): string {
        switch (this.getType(filename)) {
            case 'video': return SvgIcons.video;
            case 'image': return SvgIcons.image;
            case 'audio': return SvgIcons.audio;
            default: return SvgIcons.file;
        }
    }

    getContentTypeColor(filename: string): string {
        switch (this.getType(filename)) {
            case 'video': return 'bg-purple-500';
            case 'audio': return 'bg-green-500';
            case 'image': return 'bg-orange-500';
            case 'other': return 'bg-indigo-500';
            default: return 'bg-gray-500';
        }
    }

    // ===========================
    // 🖼 THUMBNAIL
    // ===========================

    getThumbnailUrl(media: MediaItem): string {
        console.log(media)

        switch (this.getType(media.filename)) {
            case "video":
                return `${this.API}/files/${media.id}/thumbnail`;

            case "image":
                return `${this.API}/files/${media.id}/download`;
            default:
                return `https://placehold.net/shape-600x600.png`
        }
    }

    getFile(media: MediaItem): string {
        return `${this.API}/files/${media.id}/download`;
    }

    getType(filename: string): 'video' | 'image' | 'audio' | 'document' | 'other' {
        const ext = filename.split('.').pop()?.toLowerCase();

        if (!ext) return 'other';

        const videoExt = new Set(['mp4', 'webm', 'mov', 'avi', 'mkv']);
        const imageExt = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);
        const audioExt = new Set(['mp3', 'wav', 'ogg', 'flac', 'm4a']);
        const documentExt = new Set([
            'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
            'txt', 'csv', 'md', 'rtf'
        ]);

        if (videoExt.has(ext)) return 'video';
        if (imageExt.has(ext)) return 'image';
        if (audioExt.has(ext)) return 'audio';
        if (documentExt.has(ext)) return 'document';

        return 'other';
    }

    getAuthors(): Observable<{ success: boolean; authors: { id: number; name: string; role: string }[] }> {
        return this.http.get<{ success: boolean; authors: { id: number; name: string; role: string }[] }>(`${this.API}/authors`);
    }

    getMediaLocations(): Observable<{ success: boolean; locations: { id: number; path: string }[] }> {
        return this.http.get<{ success: boolean; locations: { id: number; path: string }[] }>(`${this.API}/locations`);
    }

    // ===========================
    // 📁 MEDIA LOCATIONS
    // ===========================

    createMediaLocation(path: string): Observable<{ success: boolean; id?: number; error?: any }> {

        return this.http.post<{ success: boolean; id?: number; error?: any }>(
            `${this.API}/locations`,
            { path },
            { headers: this.getHeaders() }
        );

    }

    renameMediaLocation(id: number, path: string): Observable<{ success: boolean; error?: any }> {

        return this.http.put<{ success: boolean; error?: any }>(
            `${this.API}/locations/${id}`,
            { path },
            { headers: this.getHeaders() }
        );

    }

    deleteMediaLocation(id: number): Observable<{ success: boolean; error?: any }> {

        return this.http.delete<{ success: boolean; error?: any }>(
            `${this.API}/locations/${id}`,
            { headers: this.getHeaders() }
        );

    }

    createContentType(name: string): Observable<{ success: boolean; id?: number; error?: any }> {
        return this.http.post<{ success: boolean; id?: number; error?: any }>(
            `${this.API}/media-type`,
            { name },
            { headers: this.getHeaders() }
        );
    }

    createMedia(formData: FormData): Observable<{ success: boolean; id?: number; error?: any }> {
        return this.http.post<{ success: boolean; id?: number; error?: any }>(
            `${this.API}/upload-content`,
            formData,
            { headers: this.getHeaders() }
        );
    }

    // ===========================
    // 📅 FORMATEAR AÑO
    // ===========================

    formatYear(year: number | null): string {
        return year ? year.toString() : '—';
    }

    // ===========================
    // ⏱ DURACIÓN
    // ===========================

    formatDuration(duration: string | null): string {
        return duration ?? '—';
    }

    // ===========================
    // 📂 FILESYSTEM
    // ===========================

    listFolders(path: string): Observable<{ success: boolean; folders: string[] }> {

        const params = new HttpParams().set('path', path);

        return this.http.get<{ success: boolean; folders: string[] }>(
            `${this.API}/filesystem/list`,
            {
                headers: this.getHeaders(),
                params
            }
        );
    }
}
