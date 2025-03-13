FROM node:18-bullseye as bot

WORKDIR /app

# Copiar solo el package.json y package-lock.json primero para aprovechar la cache de Docker.
COPY package*.json ./

# Instalar dependencias
RUN npm i

# Copiar el resto de los archivos, incluyendo imágenes y demás contenido estático
COPY . .

# Copiar la imagen específica (si la ruta de origen y destino es correcta)
COPY public/img/saludo.jpg /app/public/img

# Configurar variables de entorno si es necesario
ARG RAILWAY_STATIC_URL
ARG PUBLIC_URL
ARG PORT

# Exponer el puerto si es necesario
EXPOSE ${PORT}

# Comando para ejecutar la aplicación
CMD ["npm", "start"]