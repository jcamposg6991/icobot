const { createBot, createProvider, createFlow, addKeyword, EVENTS } = require('@bot-whatsapp/bot');
const cloudinary = require('cloudinary').v2;
require("dotenv").config();

const QRPortalWeb = require('@bot-whatsapp/portal');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
const MongoAdapter = require('@bot-whatsapp/database/mongo');
const path = require("path");
const fs = require("fs");
const chat = require("./chatGPT");

// Base de la URL de Cloudinary
const cloudinaryBaseUrl = 'https://res.cloudinary.com/drkiaah01/image/upload/';

// Configurar Cloudinary con las credenciales del .env
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Cargar textos y prompts desde archivos
const pathConsultas = path.join(__dirname, "mensajes", "promptConsultas.txt");
const promptConsultas = fs.readFileSync(pathConsultas, "utf8");

const pathSaludo = path.join(__dirname, "mensajes", "saludo.txt");
const saludo = fs.readFileSync(pathSaludo, "utf8");
const imagenSaludo = "https://res.cloudinary.com/drkiaah01/image/upload/v1741850033/saludo.jpg";

const despedida = "Tu sesión de chat ha finalizado debido a inactividad. Si necesitas más ayuda, no dudes en iniciar un nuevo chat. ¡Estamos aquí para ayudarte!";

// Almacenamiento temporal para rastrear usuarios y tiempos de actividad
const usersWhoReceivedWelcome = new Set();
const userActivity = new Map();

const checkInactiveUsers = async () => {
    const now = Date.now();
    for (const [userId, lastActive] of userActivity.entries()) {
        if (now - lastActive > 24 * 60 * 60 * 1000) {
            console.log(`Enviando mensaje de despedida a ${userId}`);

            if (global.provider) {
                try {
                    const formattedUserId = userId.includes("@s.whatsapp.net") ? userId : `${userId}@s.whatsapp.net`;
                    await global.provider.sendText(formattedUserId, despedida);
                    console.log(`Mensaje enviado a ${formattedUserId}`);
                } catch (error) {
                    console.error(`Error enviando despedida a ${userId}:`, error);
                }
            }
            usersWhoReceivedWelcome.delete(userId);
            userActivity.delete(userId);
        }
    }
};
setInterval(checkInactiveUsers, 60 * 1000);

// Función para verificar si la respuesta contiene una referencia a una imagen y generar la URL de Cloudinary
const obtenerImagenesCurso = (respuestaTexto) => {
    // Usamos matchAll para capturar todas las coincidencias de "Imagen: <nombre_de_imagen>"
    const matches = [...respuestaTexto.matchAll(/Imagen:\s*(\S+)/g)];
    if (matches.length > 0) {
        const imagenes = matches.map(match => `${cloudinaryBaseUrl}${match[1].trim()}`);
        console.log("Imágenes extraídas:", imagenes);
        return imagenes; // Devuelve un array con todas las imágenes
    }
    return []; // Devuelve un array vacío si no encuentra imágenes
};

// Flujo dinámico para manejar consultas generales
const flowConsultas = addKeyword([EVENTS.MESSAGE])
    .addAnswer("*🤖IcoBot🤖*", { delay: 1 }, async (ctx, ctxFn) => {
        const userId = ctx.from;
        userActivity.set(userId, Date.now());

        if (!usersWhoReceivedWelcome.has(userId)) {
            usersWhoReceivedWelcome.add(userId);
            await ctxFn.flowDynamic(saludo, { media: imagenSaludo });
        }

        const consulta = ctx.body.trim();
        const answer = await chat(promptConsultas, consulta);
        const imagenes = obtenerImagenesCurso(answer.content); // Ahora devuelve un array con todas las imágenes

        console.log("Respuesta del bot:", answer);
        console.log("Imágenes encontradas:", imagenes);

        // Mensaje de texto sin referencias a imágenes
        let mensaje = answer.content.replace(/Imagen:\s*\S+/g, "").trim();
        await ctxFn.flowDynamic(mensaje);

        // Enviar cada imagen de forma independiente
        if (imagenes.length > 0) {
            for (const imgUrl of imagenes) {
                console.log("Enviando imagen:", imgUrl);
                await ctxFn.flowDynamic("", { media: imgUrl });
            }
        }
    });



// Configuración principal del bot
const main = async () => {
    const adapterDB = new MongoAdapter({
        dbUri: process.env.MONGO_DB_URI,
        dbName: "IcoBot",
    });

    const adapterFlow = createFlow([flowConsultas]);
    global.provider = createProvider(BaileysProvider);

    global.bot = createBot({
        flow: adapterFlow,
        provider: global.provider,
        database: adapterDB,
    });

    QRPortalWeb();
};

main();
