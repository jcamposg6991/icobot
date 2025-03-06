const { Configuration, OpenAIApi } = require("openai");
require("dotenv").config();

const chat = async (prompt, text) => {
    try {
        console.log("Verificando OPENAI_API_KEY:", process.env.OPENAI_API_KEY); // Agregado para depuración

        if (!process.env.OPENAI_API_KEY) {
            throw new Error("La clave de API de OpenAI no está configurada");
        }

        const configuration = new Configuration({
            apiKey: process.env.OPENAI_API_KEY,
        });
        const openai = new OpenAIApi(configuration);
        
        const completion = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: prompt },
                { role: "user", content: text },
            ],
        });

        return completion.data.choices[0].message;
    } catch (err) {
        console.error("Error al conectar con OpenAI:", err);
        return "ERROR";
    }
};

module.exports = chat;
