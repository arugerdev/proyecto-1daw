import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Stats, PaginatedResponse, Archivo } from '../app/models/file.model';

@Injectable({
    providedIn: 'root'
})
export class FileService {
    private apiUrl = 'http://localhost:3000/api';
    
    constructor(private http: HttpClient) {}
    
    private getHeaders(): HttpHeaders {
        const token = localStorage.getItem('token');
        return new HttpHeaders({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        });
    }
    
    getStats(): Observable<{ success: boolean; stats: Stats }> {
        return this.http.get<{ success: boolean; stats: Stats }>(
            `${this.apiUrl}/stats`,
            { headers: this.getHeaders() }
        );
    }
    
    getFilesPaginated(
        page: number,
        limit: number,
        search: string = '',
        tipo: string = '',
        sort: string = 'masReciente'
    ): Observable<PaginatedResponse> {
        let params = new HttpParams()
            .set('page', page.toString())
            .set('limit', limit.toString())
            .set('sort', sort);
        
        if (search) params = params.set('search', search);
        if (tipo) params = params.set('tipo', tipo);
        
        return this.http.get<PaginatedResponse>(
            `${this.apiUrl}/files/paginated`,
            { 
                headers: this.getHeaders(),
                params 
            }
        );
    }
    
    downloadFile(id: number): Observable<Blob> {
        return this.http.get(
            `${this.apiUrl}/files/${id}/download`,
            { 
                headers: this.getHeaders(),
                responseType: 'blob' 
            }
        );
    }
    
    deleteFile(id: number): Observable<{ success: boolean }> {
        return this.http.delete<{ success: boolean }>(
            `${this.apiUrl}/files/${id}`,
            { headers: this.getHeaders() }
        );
    }
    
    updateFileName(id: number, nombre_archivo: string): Observable<{ success: boolean }> {
        return this.http.put<{ success: boolean }>(
            `${this.apiUrl}/files/${id}`,
            { nombre_archivo },
            { headers: this.getHeaders() }
        );
    }
    
    // Utilidades para la UI
    getTipoIcon(tipo: string): string {
        switch(tipo) {
            case 'video': return '🎬';
            case 'imagen': return '🖼️';
            case 'audio': return '🎵';
            case 'documento': return '📄';
            default: return '📁';
        }
    }
    
    getTipoIconComponent(tipo: string): string {
        switch(tipo) {
            case 'video': return 'play-icon';
            case 'imagen': return 'image-icon';
            case 'audio': return 'music-icon';
            case 'documento': return 'file-text-icon';
            default: return 'file-icon';
        }
    }
    
    getTipoColor(tipo: string): string {
        switch(tipo) {
            case 'video': return 'bg-blue-500';
            case 'imagen': return 'bg-green-500';
            case 'audio': return 'bg-purple-500';
            case 'documento': return 'bg-orange-500';
            default: return 'bg-gray-500';
        }
    }
    
    getEstadoBadgeClass(estado: string = 'publicado'): string {
        switch(estado) {
            case 'publicado': return 'badge-default';
            case 'borrador': return 'badge-secondary';
            case 'archivado': return 'badge-outline';
            default: return 'badge-default';
        }
    }
    
    getEstadoText(estado: string = 'publicado'): string {
        switch(estado) {
            case 'publicado': return 'Publicado';
            case 'borrador': return 'Borrador';
            case 'archivado': return 'Archivado';
            default: return 'Publicado';
        }
    }
    
    formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 MB';
        const mb = bytes / (1024 * 1024);
        return mb.toFixed(2) + ' MB';
    }
    
    formatDate(date: string): string {
        return new Date(date).toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }
    
    // Generar thumbnail de placeholder según tipo
    getThumbnailUrl(file: Archivo): string {
        // Aquí podrías tener una URL real si el archivo es una imagen
        if (file.tipo_archivo === 'imagen') {
            // Si es imagen, podrías generar una miniatura
            return 'assets/placeholders/image-placeholder.jpg';
        }
        
        // Placeholders por tipo
        const placeholders = {
            video: 'assets/placeholders/video-placeholder.jpg',
            audio: 'assets/placeholders/audio-placeholder.jpg',
            documento: 'assets/placeholders/document-placeholder.jpg',
            otro: 'assets/placeholders/generic-placeholder.jpg'
        };
        
        return placeholders[file.tipo_archivo] || placeholders.otro;
    }
    
    // Generar título a partir del nombre
    generateTitle(filename: string): string {
        // Quitar extensión y reemplazar guiones/bajos con espacios
        return filename
            .replace(/\.[^/.]+$/, '') // Quitar extensión
            .replace(/[_-]/g, ' ')     // Reemplazar _ y - con espacios
            .replace(/\b\w/g, l => l.toUpperCase()); // Capitalizar
    }
    
    // Generar duración aleatoria para demostración
    generateRandomDuration(): string {
        const minutes = Math.floor(Math.random() * 60) + 5;
        const seconds = Math.floor(Math.random() * 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    }
}