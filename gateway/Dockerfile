# Usamos Alpine porque es muy ligero
FROM nginx:alpine

# Instalamos openssl para poder generar certificados autofirmados
RUN apk add --no-cache openssl

# Copiamos la configuración de Nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Copiamos y damos permisos al script de entrada
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Exponemos los puertos HTTP y HTTPS
EXPOSE 80 443

# Ejecutamos el script de entrada en lugar de arrancar nginx directamente
ENTRYPOINT ["/entrypoint.sh"]