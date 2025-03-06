const { createBot, createProvider, createFlow, addKeyword, EVENTS } = require('@bot-whatsapp/bot');
require("dotenv").config();

const QRPortalWeb = require('@bot-whatsapp/portal');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
//const MongoAdapter = require('@bot-whatsapp/database/mongo'); en caso de levantar sin conexion a Mongo se debe inactivar esta linea
const MockAdapter= require('@bot-whatsapp/database/json'); //en caso de levantar sin conexion a Mongo se debe activar esta linea
const path = require("path");
const fs = require("fs");
const chat = require("./chatGPT");

// Cargar textos y prompts desde archivos
const pathConsultas = path.join(__dirname, "mensajes", "promptConsultas.txt");
const promptConsultas = fs.readFileSync(pathConsultas, "utf8");

const pathSaludo = path.join(__dirname, "mensajes", "saludo.txt");
const saludo = fs.readFileSync(pathSaludo, "utf8");

const imagenSaludo = path.join(__dirname, "imagenes", "saludo.jpg");

// Almacenamiento temporal para rastrear usuarios que ya pasaron por el flujo de bienvenida
const usersWhoReceivedWelcome = new Set(); // Usamos un Set para almacenar los IDs únicos de usuarios

// Flujo dinámico para manejar consultas y el saludo inicial
const flowConsultas = addKeyword([EVENTS.MESSAGE])
    .addAnswer("*🤖IcoBot🤖*", { delay: 1 }, async (ctx, ctxFn) => {
        const userId = ctx.from; // Obtenemos el ID del usuario

        // Si el usuario no ha recibido el saludo, enviarlo primero
        if (!usersWhoReceivedWelcome.has(userId)) {
            usersWhoReceivedWelcome.add(userId); // Marcamos que este usuario ya recibió el saludo
            await ctxFn.flowDynamic(saludo,{media: imagenSaludo}); // Enviamos el saludo inicial
        }

        // Ahora manejamos la consulta del usuario
        const prompt = promptConsultas;
        const consulta = ctx.body; // Captura el mensaje del usuario
        const answer = await chat(prompt, consulta); // Responde usando lógica externa (ChatGPT u otra)
        await ctxFn.flowDynamic(answer.content); // Responde dinámicamente
    });

// Configuración principal del bot
const main = async () => {
    //const adapterDB = new MongoAdapter({
       // dbUri: process.env.MONGO_DB_URI, // Configura tu conexión en el archivo .env - En caso se levantar sin conexion a Mongo se debe inacticar este bloque
       // dbName: "IcoBot",
   // });

    const adapterDB = new MockAdapter(); //en caso de levantar sin conexion a Mongo se debe activar esta linea
    const adapterFlow = createFlow([flowConsultas]); // Solo necesitamos el flujo de consultas
    const adapterProvider = createProvider(BaileysProvider);

    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    });

    QRPortalWeb(); // Genera el código QR para conectarte a WhatsApp
};

main();