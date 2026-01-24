FROM node:20

# Instalar dependencias necesarias para librerías de red
RUN apt-get update && apt-get install -y ffmpeg libwebp-dev

WORKDIR /app

# Copiamos primero los archivos de paquetes para aprovechar el caché de Docker
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8080

CMD ["node", "index.js"]