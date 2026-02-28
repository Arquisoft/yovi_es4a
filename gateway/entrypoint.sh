#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# entrypoint.sh
# Script de entrada del contenedor gateway (Nginx).
#
# Responsabilidades:
#   1. Asegurar que existe el directorio donde se almacenan los certificados TLS.
#   2. Si no hay certificados reales (entorno local/desarrollo), generar un
#      certificado autofirmado con openssl para que Nginx pueda arrancar en HTTPS.
#   3. Lanzar Nginx en primer plano como proceso principal del contenedor.
# ─────────────────────────────────────────────────────────────────────────────

# Crear el directorio para los certificados si no existe.
# En producción (Azure), este directorio puede estar montado como volumen
# con los certificados reales ya incluidos.
mkdir -p /etc/nginx/ssl

# Comprobamos si el certificado ya existe.
# En producción los certificados se montan desde fuera (ej. Azure Key Vault,
# un volumen de Docker, etc.), por lo que el fichero ya estará presente.
# En local/desarrollo no existe, así que generamos uno autofirmado.
if [ ! -f /etc/nginx/ssl/cert.pem ]; then
    echo "⚠️ No se encontraron certificados SSL."
    echo "⚙️ Generando certificado autofirmado para desarrollo en localhost..."

    # Generamos un certificado X.509 autofirmado válido por 365 días:
    #   -x509      → genera directamente un certificado (no una CSR)
    #   -nodes     → la clave privada NO se cifra con contraseña (necesario
    #                para que Nginx la lea sin intervención humana al arrancar)
    #   -days 365  → validez de un año
    #   -newkey rsa:2048 → crea una nueva clave RSA de 2048 bits
    #   -keyout    → ruta donde se guarda la clave privada
    #   -out       → ruta donde se guarda el certificado
    #   -subj      → datos del sujeto del certificado (evita el prompt interactivo)
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/key.pem \
        -out    /etc/nginx/ssl/cert.pem \
        -subj "/C=ES/ST=Asturias/L=Oviedo/O=Yovi/CN=localhost"

    echo "✅ Certificado autofirmado generado con éxito."
else
    echo "🔒 Certificados SSL detectados (Producción/Azure). Procediendo al arranque."
fi

# Arrancamos Nginx en primer plano.
# 'daemon off' es obligatorio en contenedores Docker: si Nginx se ejecutase
# en segundo plano (modo daemon), el proceso principal terminaría y Docker
# detendría el contenedor inmediatamente al no detectar ningún proceso activo.
# Con 'exec' reemplazamos el proceso del shell por el de Nginx, de modo que
# Nginx pasa a ser el PID 1 y recibe correctamente las señales del sistema
# (SIGTERM, SIGINT) cuando se detiene el contenedor.
exec nginx -g "daemon off;"