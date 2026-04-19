export type UserRole = 'owner' | 'admin' | 'moderator' | 'viewer';
export type MediaKind = 'video' | 'audio' | 'image' | 'document' | 'text' | 'other';
export type StorageType = 'local' | 'url' | 'smb' | 'ftp' | 'nfs';

export interface MediaItem {
  id: number;
  title: string;
  description: string | null;
  file_path: string;
  filename: string;
  storage_location_id: number | null;
  mime_type: string | null;
  file_size: number;
  file_size_formatted?: string;
  file_extension: string | null;
  media_kind: MediaKind;
  duration: number | null;
  width: number | null;
  height: number | null;
  thumbnail_path: string | null;
  publication_year: number | null;
  category_id: number | null;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  location_name?: string;
  location_path?: string;
  storage_type?: StorageType;
  created_by: number | null;
  created_by_name?: string;
  view_count: number;
  download_count: number;
  is_public: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  parent_id: number | null;
  media_count?: number;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
  media_count?: number;
}

export interface StorageLocation {
  id: number;
  name: string;
  base_path: string;
  storage_type: StorageType;
  description: string | null;
  is_active: boolean;
}

export interface User {
  id: number;
  username: string;
  email?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface UserPermissions {
  canViewContent: boolean;
  canDownload: boolean;
  canUpload: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageUsers: boolean;
  canManageCategories: boolean;
  canImportCSV: boolean;
  canAccessAdmin: boolean;
  canPerformUpdates: boolean;
  canViewLogs: boolean;
  role: UserRole;
  level: number;
}

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
  token: string;
  permissions: UserPermissions;
}

export interface Stats {
  total: number;
  totalSize: number;
  totalSizeFormatted: string;
  byKind: { media_kind: MediaKind; count: number }[];
  byYear: { year: number; count: number }[];
  topCategories: { name: string; color: string; count: number }[];
  topTags: { name: string; color: string; count: number }[];
  recentMedia: Pick<MediaItem, 'id' | 'title' | 'media_kind' | 'created_at'>[];
  userCount: number;
  locationCount: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface MediaFilter {
  search?: string;
  type?: MediaKind | '';
  category?: string;
  tag?: string;
  year?: number | '';
  sort?: 'newest' | 'oldest' | 'title_asc' | 'title_desc' | 'year_desc' | 'year_asc' | 'size_desc' | 'size_asc' | 'views';
  page?: number;
  limit?: number;
}

export const MEDIA_KIND_LABELS: Record<MediaKind, string> = {
  video: 'Video',
  audio: 'Audio',
  image: 'Imagen',
  document: 'Documento',
  text: 'Texto',
  other: 'Otro'
};

export const MEDIA_KIND_ICONS: Record<MediaKind, string> = {
  video: '🎬',
  audio: '🎵',
  image: '🖼️',
  document: '📄',
  text: '📝',
  other: '📦'
};

export const MEDIA_KIND_COLORS: Record<MediaKind, string> = {
  video:    '#7c3aed',
  audio:    '#10b981',
  image:    '#3b82f6',
  document: '#f59e0b',
  text:     '#6b7280',
  other:    '#64748b'
};

export const ROLE_LABELS: Record<UserRole, string> = {
  owner:     'Propietario',
  admin:     'Administrador',
  moderator: 'Moderador',
  viewer:    'Visualizador'
};

export const ROLE_COLORS: Record<UserRole, string> = {
  owner:     'bg-yellow-600/20 text-yellow-300 border-yellow-600/30',
  admin:     'bg-red-600/20 text-red-300 border-red-600/30',
  moderator: 'bg-blue-600/20 text-blue-300 border-blue-600/30',
  viewer:    'bg-surface-700 text-surface-300 border-surface-600'
};
