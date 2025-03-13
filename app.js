const { createBot, createProvider, createFlow, addKeyword, EVENTS } = require('@bot-whatsapp/bot');
require("dotenv").config();

const QRPortalWeb = require('@bot-whatsapp/portal');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
const MongoAdapter = require('@bot-whatsapp/database/mongo');
const path = require("path");
const fs = require("fs");
const chat = require("./chatGPT");

// Cargar textos y prompts desde archivos
const pathConsultas = path.join(__dirname, "mensajes", "promptConsultas.txt");
const promptConsultas = fs.readFileSync(pathConsultas, "utf8");

const pathSaludo = path.join(__dirname, "mensajes", "saludo.txt");
const saludo = fs.readFileSync(pathSaludo, "utf8");
const imagenSaludo = path.join(__dirname, "imagenes", "saludo.jpg");

const despedida = "Tu sesión de chat ha finalizado debido a inactividad. Si necesitas más ayuda, no dudes en iniciar un nuevo chat. ¡Estamos aquí para ayudarte!";

// Almacenamiento temporal para rastrear usuarios y tiempos de actividad
const usersWhoReceivedWelcome = new Set();
const userActivity = new Map();

const checkInactiveUsers = async () => {
    const now = Date.now();
    for (const [userId, lastActive] of userActivity.entries()) {
        if (now - lastActive > 1 * 60 * 1000) { // 10 minutos
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
setInterval(checkInactiveUsers, 60 * 1000); // Verificar cada minuto

// Flujo dinámico para manejar consultas generales
const flowConsultas = addKeyword([EVENTS.MESSAGE])
    .addAnswer("*IcoBot*", { delay: 1 }, async (ctx, ctxFn) => {
        const userId = ctx.from;
        userActivity.set(userId, Date.now());

        if (!usersWhoReceivedWelcome.has(userId)) {
            usersWhoReceivedWelcome.add(userId);
            await ctxFn.flowDynamic(saludo, { media: imagenSaludo });
        }

        const consulta = ctx.body.trim();
        const answer = await chat(promptConsultas, consulta);

        await ctxFn.flowDynamic(answer.content);
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
