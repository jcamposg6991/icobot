const { createBot, createProvider, createFlow, addKeyword, EVENTS } = require('@bot-whatsapp/bot');
const QRPortalWeb = require('@bot-whatsapp/portal');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
const MockAdapter = require('@bot-whatsapp/database/json');
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
const usersWhoReceivedWelcome = new Set();

// Función para verificar si la respuesta contiene una referencia a una imagen
const obtenerImagenCurso = (respuestaTexto) => {
    const matchImagen = respuestaTexto.match(/Imagen:\s*(.*)/); // Busca "Imagen: nombre.jpg"
    if (matchImagen) {
        const rutaImagen = path.resolve(__dirname, "imagenes", matchImagen[1].trim());
        if (fs.existsSync(rutaImagen)) {
            console.log(`Imagen encontrada: ${rutaImagen}`);
            return rutaImagen;
        }
    }
    return null;
};

// Flujo dinámico para manejar consultas generales (cursos u otros temas)
const flowConsultas = addKeyword([EVENTS.MESSAGE])
    .addAnswer("*🤖IcoBot🤖*", { delay: 1 }, async (ctx, ctxFn) => {
        const userId = ctx.from;

        try {
            console.log(`Usuario ID: ${userId}`);

            // Enviar saludo si el usuario es nuevo
            if (!usersWhoReceivedWelcome.has(userId)) {
                usersWhoReceivedWelcome.add(userId);
                console.log("Enviando saludo...");
                await ctxFn.flowDynamic(saludo, { media: imagenSaludo });
            }

            // Procesar la consulta del usuario
            const consulta = ctx.body.trim();
            console.log(`Consulta recibida: ${consulta}`);

            const answer = await chat(promptConsultas, consulta); // ChatGPT responde
            console.log("Respuesta de ChatGPT:", answer);

            if (!answer || !answer.content) {
                console.log("No se obtuvo una respuesta válida de ChatGPT");
                return;
            }

            // Buscar si la respuesta incluye una imagen
            const rutaImagen = obtenerImagenCurso(answer.content);

            if (rutaImagen) {
                console.log("Enviando mensaje con imagen...");
                await ctxFn.flowDynamic(answer.content.replace(/Imagen:.*$/, "").trim(), { media: rutaImagen });
            } else {
                console.log("Enviando solo el contenido de texto...");
                await ctxFn.flowDynamic(answer.content);
            }
        } catch (error) {
            console.error("Error procesando la consulta:", error);
            await ctxFn.flowDynamic("Lo siento, algo salió mal al procesar tu consulta.");
        }
    });

// Configuración principal del bot
const main = async () => {
    const adapterDB = new MockAdapter();
    const adapterFlow = createFlow([flowConsultas]);
    const adapterProvider = createProvider(BaileysProvider);

    try {
        console.log("Iniciando el bot...");
        await createBot({
            flow: adapterFlow,
            provider: adapterProvider,
            database: adapterDB,
        });

        QRPortalWeb();
    } catch (error) {
        console.error("Error al iniciar el bot:", error);
    }
};

// Captura global de promesas no manejadas
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', reason);
    console.error('Promise:', promise);
});

main();
