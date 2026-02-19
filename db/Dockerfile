FROM mysql:8.0

# Copiar scripts de inicialización
COPY ./main.sql /docker-entrypoint-initdb.d/

# Copiar configuración personalizada de MySQL
COPY ./my.cnf /etc/mysql/conf.d/my.cnf

# Exponer puerto
EXPOSE 3306