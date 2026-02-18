export interface Archivo {
    id_archivo: number;
    id_item: number | null;
    nombre_archivo: string;
    tipo_archivo: 'video' | 'imagen' | 'audio' | 'documento' | 'otro';
    extension: string;
    size: number;
    ruta_fisica: string;
    fecha_subida: string;
    titulo?: string;
    descripcion?: string;
    categoria?: string;
    estado?: 'publicado' | 'borrador' | 'archivado';
    duracion?: string;
    etiquetas?: string[];
    ubicacion?: string;
    createdBy?: string;
}

export interface Stats {
    total: number;
    videos: number;
    imagenes: number;
    storage: {
        bytes: number;
        formatted: string;
    };
}

export interface PaginatedResponse {
    success: boolean;
    files: Archivo[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}