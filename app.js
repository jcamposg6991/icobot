const { createBot, createProvider, createFlow, addKeyword, EVENTS } = require('@bot-whatsapp/bot');
const cloudinary = require('cloudinary').v2;
require("dotenv").config();

const QRPortalWeb = require('@bot-whatsapp/portal');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
const MongoAdapter = require('@bot-whatsapp/database/mongo');
const path = require("path");
const fs = require("fs");
const chat = require("./chatGPT");

const cloudinaryBaseUrl = 'https://res.cloudinary.com/drkiaah01/image/upload/';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const pathConsultas = path.join(__dirname, "mensajes", "promptConsultas.txt");
const promptConsultas = fs.readFileSync(pathConsultas, "utf8");

const pathSaludo = path.join(__dirname, "mensajes", "saludo.txt");
const saludo = fs.readFileSync(pathSaludo, "utf8");
const imagenSaludo = "https://res.cloudinary.com/drkiaah01/image/upload/v1741850033/saludo.jpg";

const despedida = "Tu sesión de chat ha finalizado debido a inactividad. Si necesitas más ayuda, no dudes en iniciar un nuevo chat. ¡Estamos aquí para ayudarte!";

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

const obtenerImagenesCurso = (respuestaTexto) => {
    console.log("Texto de respuesta recibido:", respuestaTexto);
    const matches = respuestaTexto.match(/Imagen:\s*(.*)/g);
    if (matches) {
        const imagenes = matches.map(match => {
            const nombreImagen = match.replace("Imagen:", "").trim();
            return `${cloudinaryBaseUrl}${nombreImagen}`;
        });
        console.log("Imágenes extraídas:", imagenes);
        return imagenes;
    }
    console.log("No se encontraron imágenes en la respuesta.");
    return [];
};

const flowConsultas = addKeyword([EVENTS.MESSAGE])
    .addAnswer("*🤖IcoBot🤖*", { delay: 1 }, async (ctx, ctxFn) => {
        const userId = ctx.from;
        console.log("Usuario activo:", userId);
        userActivity.set(userId, Date.now());

        if (!usersWhoReceivedWelcome.has(userId)) {
            usersWhoReceivedWelcome.add(userId);
            console.log("Enviando mensaje de saludo a:", userId);
            await ctxFn.flowDynamic(saludo, { media: imagenSaludo });
        }

        const consulta = ctx.body.trim();
        console.log("Consulta recibida:", consulta);

        const answer = await chat(promptConsultas, consulta);
        console.log("Respuesta del chatGPT:", answer.content);

        const imagenes = obtenerImagenesCurso(answer.content);
        let mensaje = answer.content.replace(/Imagen:.*$/g, "").trim();
        console.log("Mensaje sin referencias a imágenes:", mensaje);

        if (imagenes.length > 0) {
            await ctxFn.flowDynamic(mensaje);
            for (const imgUrl of imagenes) {
                console.log("Enviando imagen:", imgUrl);
                await ctxFn.flowDynamic("", { media: imgUrl });
            }
        } else {
            await ctxFn.flowDynamic(mensaje);
        }
    });

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
