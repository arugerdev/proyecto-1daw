import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Stats, PaginatedResponse, MediaItem } from '../app/models/file.model';
import { SvgIcons } from '../app/utils/svg-icons';

@Injectable({
    providedIn: 'root'
})
export class FileService {

    private apiUrl = 'http://localhost:3000/api';

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
        return this.http.get<{ success: boolean; stats: Stats }>(
            `${this.apiUrl}/stats`,
            { headers: this.getHeaders() }
        );
    }

    // ===========================
    // 📄 MEDIA PAGINADO
    // ===========================

    getMediaPaginated(
        page: number,
        limit: number,
        search: string = ''
    ): Observable<PaginatedResponse> {

        let params = new HttpParams()
            .set('page', page.toString())
            .set('limit', limit.toString());

        if (search) params = params.set('search', search);

        return this.http.get<PaginatedResponse>(
            `${this.apiUrl}/files/paginated`,
            {
                headers: this.getHeaders(),
                params
            }
        );
    }

    // ===========================
    // 📥 DESCARGAR
    // ===========================

    downloadMedia(id: number): Observable<Blob> {
        return this.http.get(
            `${this.apiUrl}/files/${id}/download`,
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
            `${this.apiUrl}/files/${id}`,
            { headers: this.getHeaders() }
        );
    }

    // ===========================
    // ✏ EDITAR METADATA
    // ===========================

    updateMedia(id: number, data: Partial<MediaItem>): Observable<{ success: boolean }> {
        return this.http.put<{ success: boolean }>(
            `${this.apiUrl}/files/${id}`,
            data,
            { headers: this.getHeaders() }
        );
    }

    // ===========================
    // 🎨 ICONOS POR CONTENT TYPE
    // ===========================

    getContentTypeIcon(contentType: string): string {
        switch (contentType?.toLowerCase()) {
            case 'cortometraje': return SvgIcons.video;
            case 'videoclip': return SvgIcons.video;
            case 'streaming': return SvgIcons.video;
            case 'telediario': return SvgIcons.video;
            case 'publicidad': return SvgIcons.file;
            case 'webinar': return SvgIcons.video;
            default: return SvgIcons.location;
        }
    }

    getContentTypeColor(contentType: string): string {
        switch (contentType?.toLowerCase()) {
            case 'cortometraje': return 'bg-blue-500';
            case 'videoclip': return 'bg-purple-500';
            case 'streaming': return 'bg-green-500';
            case 'telediario': return 'bg-red-500';
            case 'publicidad': return 'bg-orange-500';
            case 'webinar': return 'bg-indigo-500';
            default: return 'bg-gray-500';
        }
    }

    // ===========================
    // 🖼 THUMBNAIL
    // ===========================

    getThumbnailUrl(media: MediaItem): string {

        // Si es imagen real (si en el futuro soportas imágenes reales)
        if (media.file_path?.match(/\.(jpg|jpeg|png|webp)$/i)) {
            return media.file_path;
        }

        return 'https://placehold.net/4-800x600.png';
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
}
