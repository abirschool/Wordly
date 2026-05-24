module.exports = async (req, res) => {
    const allowedOrigins = (process.env.FRONTEND_ORIGINS || "https://abirschool.github.io")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Vary", "Origin");
    }

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "Missing API_KEY" });
        }

        const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
        const text = body.text;

        if (!text || !String(text).trim()) {
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
                        content: String(text)
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

        return res.status(200).json({ enhancedText });
    } catch {
        return res.status(500).json({ error: "Failed to enhance text" });
    }
};
