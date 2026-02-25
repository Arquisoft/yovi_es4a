#!/bin/sh

# Crear el directorio para los certificados si no existe
mkdir -p /etc/nginx/ssl

# Comprobar si los certificados ya están montados (ej. desde Azure)
if [ ! -f /etc/nginx/ssl/cert.pem ]; then
    echo "⚠️ No se encontraron certificados SSL."
    echo "⚙️ Generando certificado autofirmado para desarrollo en localhost..."
    
    # Generar un certificado autofirmado válido por 365 días
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/key.pem \
        -out /etc/nginx/ssl/cert.pem \
        -subj "/C=ES/ST=Asturias/L=Oviedo/O=Yovi/CN=localhost"
        
    echo "✅ Certificado autofirmado generado con éxito."
else
    echo "🔒 Certificados SSL detectados (Producción/Azure). Procediendo al arranque."
fi

# Arrancar Nginx en primer plano
exec nginx -g "daemon off;"