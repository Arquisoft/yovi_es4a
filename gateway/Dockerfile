FROM node:18-alpine
RUN apk add nginx
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Copiamos la config de nginx
COPY nginx.conf /etc/nginx/http.d/default.conf
RUN mkdir -p /etc/nginx/certs
EXPOSE 80 443
# Arrancamos Nginx y Node a la vez
CMD nginx && node server.js