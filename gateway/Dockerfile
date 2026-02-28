# ─────────────────────────────────────────────────────────────────────────────
# Imagen base: nginx sobre Alpine Linux.
# Alpine es una distribución minimalista (~5 MB) ideal para contenedores de
# producción porque reduce la superficie de ataque y el tamaño final de la imagen.
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:alpine

# Instalamos openssl, necesario para generar certificados TLS autofirmados
# cuando no se proporcionan certificados reales (entorno de desarrollo/local).
# --no-cache evita guardar el índice de paquetes, manteniendo la imagen ligera.
RUN apk add --no-cache openssl

# Sustituimos la configuración por defecto de Nginx por la nuestra propia,
# que define los servidores HTTP/HTTPS y las reglas de proxy inverso.
COPY nginx.conf /etc/nginx/nginx.conf

# Copiamos el script de entrada que se encargará de:
#   1. Generar un certificado autofirmado si no hay uno real montado.
#   2. Arrancar Nginx en primer plano.
COPY entrypoint.sh /entrypoint.sh

# Damos permisos de ejecución al script para que el contenedor pueda lanzarlo.
RUN chmod +x /entrypoint.sh

# Declaramos los puertos que el contenedor escucha:
#   - 80  → HTTP (redirige automáticamente a HTTPS)
#   - 443 → HTTPS (tráfico cifrado TLS)
EXPOSE 80 443

# Usamos ENTRYPOINT en lugar de CMD para que el script sea el proceso principal
# (PID 1) del contenedor. Esto garantiza que las señales del sistema (SIGTERM,
# SIGINT) se gestionen correctamente al detener el contenedor.
ENTRYPOINT ["/entrypoint.sh"]