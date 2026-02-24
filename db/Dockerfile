FROM mysql:8.0

# Copiar configuración personalizada de MySQL
COPY ./my.cnf /etc/mysql/conf.d/my.cnf

# Copiar scripts de inicialización
COPY init.sql /docker-entrypoint-initdb.d/

# Exponer puerto
EXPOSE 3306