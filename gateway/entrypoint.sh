#!/bin/sh

DOMAIN="yovies4a.duckdns.org"
EMAIL="admin@yovies4a.duckdns.org"

# Crear el directorio para los certificados si no existe
mkdir -p /etc/nginx/ssl

echo "🌐 Intentando obtener certificado Let's Encrypt para $DOMAIN..."
# Pedimos el certificado a Let's Encrypt (el puerto 80 debe estar libre, ideal antes de arrancar Nginx)
certbot certonly --standalone -d $DOMAIN --non-interactive --agree-tos -m $EMAIL || true

# Comprobar si Certbot tuvo éxito
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "✅ Certificado oficial Let's Encrypt configurado."
    cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /etc/nginx/ssl/cert.pem
    cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /etc/nginx/ssl/key.pem
else
    echo "⚠️ Falló Let's Encrypt. Comprobando si hay certificados existentes..."
    if [ ! -f /etc/nginx/ssl/cert.pem ]; then
        echo "⚙️ Generando certificado autofirmado de respaldo..."
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout /etc/nginx/ssl/key.pem \
            -out /etc/nginx/ssl/cert.pem \
            -subj "/C=ES/ST=Asturias/L=Oviedo/O=Yovi/CN=$DOMAIN"
    fi
fi

# Arrancar Nginx en primer plano
exec nginx -g "daemon off;"