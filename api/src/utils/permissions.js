const ROLE_LEVELS = { viewer: 1, moderator: 2, admin: 3, owner: 4 };

const ROLE_PERMISSIONS = {
    viewer: {
        canViewContent: true,
        canDownload: false,
        canUpload: false,
        canEdit: false,
        canDelete: false,
        canManageUsers: false,
        canManageCategories: false,
        canImportCSV: false,
        canAccessAdmin: false,
        canPerformUpdates: false,
        canViewLogs: false
    },
    moderator: {
        canViewContent: true,
        canDownload: true,
        canUpload: true,
        canEdit: true,
        canDelete: false,
        canManageUsers: false,
        canManageCategories: false,
        canImportCSV: false,
        canAccessAdmin: false,
        canPerformUpdates: false,
        canViewLogs: false
    },
    admin: {
        canViewContent: true,
        canDownload: true,
        canUpload: true,
        canEdit: true,
        canDelete: true,
        canManageUsers: true,
        canManageCategories: true,
        canImportCSV: true,
        canAccessAdmin: true,
        canPerformUpdates: false,
        canViewLogs: false
    },
    owner: {
        canViewContent: true,
        canDownload: true,
        canUpload: true,
        canEdit: true,
        canDelete: true,
        canManageUsers: true,
        canManageCategories: true,
        canImportCSV: true,
        canAccessAdmin: true,
        canPerformUpdates: true,
        canViewLogs: true
    }
};

function getPermissions(role) {
    return {
        ...(ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer),
        role,
        level: ROLE_LEVELS[role] || 1
    };
}

function hasPermission(role, permission) {
    return (ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer)[permission] === true;
}

module.exports = { ROLE_LEVELS, ROLE_PERMISSIONS, getPermissions, hasPermission };
