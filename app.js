const { createBot, createProvider, createFlow, addKeyword, EVENTS } = require('@bot-whatsapp/bot');
require("dotenv").config();

const QRPortalWeb = require('@bot-whatsapp/portal');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
const MongoAdapter = require('@bot-whatsapp/database/mongo');
const path = require("path");
const fs = require("fs");
const chat = require("./chatGPT");

const pathConsultas = path.join(__dirname, "mensajes", "promptConsultas.txt");
const promptConsultas = fs.readFileSync(pathConsultas, "utf8");
const pathSaludo = path.join(__dirname, "mensajes", "saludo.txt");
const saludo = fs.readFileSync(pathSaludo, "utf8");
const imagenSaludo = path.join(__dirname, "imagenes", "saludo.jpg");

const usersWhoReceivedWelcome = new Set();
const userTimers = new Map();

const TIMEOUT = 1 * 60 * 1000; // 1 minuto en milisegundos

const startUserTimeout = (userId, ctxFn) => {
    if (userTimers.has(userId)) {
        clearTimeout(userTimers.get(userId));
    }
    
    const timeout = setTimeout(async () => {
        await ctxFn.sendMessage(userId, "⚠️ Tu sesión ha expirado por inactividad. Si necesitas ayuda, envía un nuevo mensaje.");
        usersWhoReceivedWelcome.delete(userId);
        userTimers.delete(userId);
    }, TIMEOUT);

    userTimers.set(userId, timeout);
};

const flowConsultas = addKeyword([EVENTS.MESSAGE])
    .addAnswer("*🤖IcoBot🤖*", { delay: 1 }, async (ctx, ctxFn) => {
        const userId = ctx.from;

        if (!usersWhoReceivedWelcome.has(userId)) {
            usersWhoReceivedWelcome.add(userId);
            await ctxFn.flowDynamic(saludo);
        }

        startUserTimeout(userId, ctxFn);
        
        const prompt = promptConsultas;
        const consulta = ctx.body;
        const answer = await chat(prompt, consulta);
        await ctxFn.flowDynamic(answer.content);
    });

const main = async () => {
    const adapterDB = new MongoAdapter({
       dbUri: process.env.MONGO_DB_URI,
       dbName: "IcoBot",
   });
    
    const adapterFlow = createFlow([flowConsultas]);
    const adapterProvider = createProvider(BaileysProvider);

    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    });

    QRPortalWeb();
};

main();
