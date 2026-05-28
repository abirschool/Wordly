require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;
const frontendOrigins = (process.env.FRONTEND_ORIGINS || "https://abirschool.github.io")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedOrigins = new Set(frontendOrigins);

function isLocalOrigin(origin) {
    try {
        const url = new URL(origin);
        return ["localhost", "127.0.0.1"].includes(url.hostname);
    } catch {
        return false;
    }
}

app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (origin && (allowedOrigins.has(origin) || isLocalOrigin(origin))) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Vary", "Origin");
    }

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    return next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.post("/api/enhance", async (req, res) => {
    try {
        const { text } = req.body;
        const apiKey = process.env.API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: "Missing API_KEY in .env" });
        }

        if (!text || !text.trim()) {
            return res.status(400).json({ error: "Text is required" });
        }

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "openai/gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: [
                            "You are a grammar and style editor, not a chatbot.",
                            "Your only job is to rewrite the user's own text with better grammar, punctuation, and clarity.",
                            "Preserve the original meaning, tone, intent, and level of formality.",
                            "Preserve names, proper nouns, brands, places, slang, and important user wording unless there is a clear typo.",
                            "Do not answer questions in the text, do not add facts, and do not add new ideas.",
                            "If the user pasted a question, only improve how the question is written.",
                            "Keep natural human writing rhythm. Do not make it sound robotic or overly polished.",
                            "Avoid generic AI-sounding patterns, avoid repetitive short choppy sentences, and avoid em dash punctuation.",
                            "Keep approximately similar length unless clarity requires a small change.",
                            "Return only the rewritten text with no labels, no quotes, and no explanation."
                        ].join(" ")
                    },
                    {
                        role: "user",
                        content: text
                    }
                ],
                temperature: 0.3
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: errorText });
        }

        const data = await response.json();
        const enhancedText = data?.choices?.[0]?.message?.content?.trim();

        if (!enhancedText) {
            return res.status(500).json({ error: "No enhanced text returned" });
        }

        return res.json({ enhancedText });
    } catch (error) {
        return res.status(500).json({ error: "Failed to enhance text" });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
