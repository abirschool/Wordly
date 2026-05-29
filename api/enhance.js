function normalizeOrigin(value) {
    if (!value) {
        return "";
    }

    try {
        return new URL(value).origin.toLowerCase();
    } catch {
        return value.trim().toLowerCase();
    }
}

function countWords(value) {
    const text = String(value || "").trim();
    if (!text) {
        return 0;
    }

    return text.split(/\s+/).filter(Boolean).length;
}

function countSentences(value) {
    const text = String(value || "").trim();
    if (!text) {
        return 0;
    }

    return text.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean).length;
}

function tokenize(value) {
    return String(value || "")
        .toLowerCase()
        .match(/[a-z0-9']+/g) || [];
}

function lexicalOverlapRatio(originalText, editedText) {
    const originalTokens = tokenize(originalText).filter((token) => token.length > 2);
    const editedTokens = tokenize(editedText).filter((token) => token.length > 2);

    if (!originalTokens.length || !editedTokens.length) {
        return 1;
    }

    const originalSet = new Set(originalTokens);
    const editedSet = new Set(editedTokens);
    let overlapCount = 0;

    for (const token of originalSet) {
        if (editedSet.has(token)) {
            overlapCount += 1;
        }
    }

    return overlapCount / originalSet.size;
}

function detectChatbotDrift(originalText, editedText) {
    const originalWords = countWords(originalText);
    const editedWords = countWords(editedText);
    const originalHasQuestion = /\?/.test(originalText);
    const editedHasQuestion = /\?/.test(editedText);
    const overlap = lexicalOverlapRatio(originalText, editedText);

    if (originalHasQuestion && !editedHasQuestion) {
        return true;
    }

    if (originalWords <= 25 && editedWords > originalWords + 20) {
        return true;
    }

    if (originalWords >= 12 && overlap < 0.55) {
        return true;
    }

    return false;
}

function buildMaxTokens(text) {
    const wordCount = countWords(text);
    const dynamicLimit = Math.ceil(wordCount * 1.8) + 30;
    return Math.max(80, Math.min(1400, dynamicLimit));
}

function looksLikeExpansion(originalText, editedText) {
    const originalWords = countWords(originalText);
    const editedWords = countWords(editedText);
    const originalSentences = countSentences(originalText);
    const editedSentences = countSentences(editedText);

    if (originalWords === 0 || editedWords === 0) {
        return false;
    }

    const wordsExpandedTooMuch = editedWords > Math.max(originalWords * 1.18, originalWords + 14);
    const sentencesExpandedTooMuch = editedSentences > originalSentences + 1;

    return wordsExpandedTooMuch || sentencesExpandedTooMuch;
}

async function requestGrammarEdit(apiKey, text, strictMode = false) {
    const systemRules = strictMode
        ? [
            "You are a strict grammar copy editor.",
            "Only edit grammar, punctuation, spelling, and small clarity issues.",
            "Do not add facts, examples, explanations, or new ideas.",
            "Do not answer any question in the text.",
            "Preserve names, proper nouns, slang, tone, and writer intent.",
            "Keep paragraph count and sentence count almost the same.",
            "Keep output length close to input length.",
            "Return only the edited text."
        ].join(" ")
        : [
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
        ].join(" ");

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
                    content: systemRules
                },
                {
                    role: "user",
                    content: String(text)
                }
            ],
            temperature: strictMode ? 0 : 0.2,
            max_tokens: buildMaxTokens(text)
        })
    });

    return response;
}

module.exports = async (req, res) => {
    const allowedOrigins = new Set(
        (process.env.FRONTEND_ORIGINS || "https://abirschool.github.io")
            .split(",")
            .map((origin) => normalizeOrigin(origin))
            .filter(Boolean)
    );

    const origin = normalizeOrigin(req.headers.origin);
    if (origin && allowedOrigins.has(origin)) {
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

        let response = await requestGrammarEdit(apiKey, text, false);

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: errorText });
        }

        let data = await response.json();
        let enhancedText = data?.choices?.[0]?.message?.content?.trim();

        if (enhancedText && (looksLikeExpansion(text, enhancedText) || detectChatbotDrift(text, enhancedText))) {
            response = await requestGrammarEdit(apiKey, text, true);

            if (!response.ok) {
                const errorText = await response.text();
                return res.status(response.status).json({ error: errorText });
            }

            data = await response.json();
            enhancedText = data?.choices?.[0]?.message?.content?.trim();
        }

        if (enhancedText && (looksLikeExpansion(text, enhancedText) || detectChatbotDrift(text, enhancedText))) {
            enhancedText = text.trim();
        }

        if (!enhancedText) {
            return res.status(500).json({ error: "No enhanced text returned" });
        }

        return res.status(200).json({ enhancedText });
    } catch {
        return res.status(500).json({ error: "Failed to enhance text" });
    }
};
