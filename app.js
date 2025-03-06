const { createBot, createProvider, createFlow, addKeyword, EVENTS } = require('@bot-whatsapp/bot');
require("dotenv").config();

const QRPortalWeb = require('@bot-whatsapp/portal');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
// const MongoAdapter = require('@bot-whatsapp/database/mongo');
const MongoAdapter = require('@bot-whatsapp/database/json');
const path = require("path");
const fs = require("fs");
const chat = require("./chatGPT");
const { log } = require('console');

// Cargar textos y prompts desde archivos
const pathConsultas = path.join(__dirname, "mensajes", "promptConsultas.txt");
const promptConsultas = fs.readFileSync(pathConsultas, "utf8");

const pathSaludo = path.join(__dirname, "mensajes", "saludo.txt");
const saludo = fs.readFileSync(pathSaludo, "utf8");

const imagenSaludo = path.join(__dirname, "imagenes", "saludo.jpg");

// Almacenamiento temporal para rastrear usuarios que ya pasaron por el flujo de bienvenida
const usersWhoReceivedWelcome = new Set(); 

// Función para verificar si la respuesta contiene una referencia a una imagen
const obtenerImagenCurso = (respuestaTexto) => {
    const matchImagen = respuestaTexto.match(/Imagen:\s*(.*)/); // Busca "Imagen: nombre.jpg"
    if (matchImagen) {
        const rutaImagen = path.resolve(__dirname, "imagenes", matchImagen[1].trim());
        if (fs.existsSync(rutaImagen)) {
            console.log(rutaImagen);
            return rutaImagen; 
        }
    }
    return null;
};

// Flujo dinámico para manejar consultas generales (cursos u otros temas)
const flowConsultas = addKeyword([EVENTS.MESSAGE])
    .addAnswer("*🤖IcoBot🤖*", { delay: 1 }, async (ctx, ctxFn) => {
        const userId = ctx.from; 

        // Enviar saludo si el usuario es nuevo
        if (!usersWhoReceivedWelcome.has(userId)) {
            usersWhoReceivedWelcome.add(userId);
            await ctxFn.flowDynamic(saludo, { media: imagenSaludo });
        }

        // Procesar la consulta del usuario
        const consulta = ctx.body.trim();
        console.log(consulta);
        const answer = await chat(promptConsultas, consulta); // ChatGPT responde
        console.log(answer);
        

        // Buscar si la respuesta incluye una imagen
        const rutaImagen = obtenerImagenCurso(answer.content);

        if (rutaImagen) {
            await ctxFn.flowDynamic(answer.content.replace(/Imagen:.*$/, "").trim(), { media: rutaImagen });
        } else {
            await ctxFn.flowDynamic(answer.content);
        }
    });

// Configuración principal del bot
const main = async () => {
    const adapterDB = new MockAdapter();
    // const adapterDB = new MongoAdapter({
    //     dbUri: process.env.MONGO_DB_URI, 
    //     dbName: "IcoBot",
    // });

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
