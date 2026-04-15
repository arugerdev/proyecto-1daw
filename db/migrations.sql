USE administradorMultimedia;

ALTER TABLE users DROP CHECK users_chk_2;
ALTER TABLE users
ADD CONSTRAINT chk_rol
CHECK (rol IN ('owner', 'admin', 'moderator', 'viewer'));

UPDATE users SET rol = 'owner' WHERE id_user = 1;