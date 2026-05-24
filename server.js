require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

const allowedOrigins = new Set([
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:5501",
    "http://localhost:5501",
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`
]);

app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (origin && allowedOrigins.has(origin)) {
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
                        content: "You improve grammar and clarity while preserving the original meaning. Return only the improved text."
                    },
                    {
                        role: "user",
                        content: text
                    }
                ]
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
