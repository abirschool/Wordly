// Counter Logic

const input = document.querySelector(".text-input");
let words = document.querySelector(".wordDisplay");
let characters = document.querySelector(".characterDisplay");
const enhanceButton = document.querySelector(".enhanceBtn");
const enhanceStatus = document.querySelector(".enhanceStatus");
const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const isGitHubPages = window.location.hostname.endsWith("github.io");
const apiMetaTag = document.querySelector('meta[name="wordly-api-base"]');
const configuredApiBase = (apiMetaTag?.content || "").trim().replace(/\/+$/, "");
const apiBase = isLocalHost ? "http://localhost:3000" : configuredApiBase;


Counter();

function Counter(){

    input.addEventListener("input", () => {

        characters.innerHTML = input.value.length;

        const text = input.value.trim();

        if (text === ""){
            words.innerHTML = 0;
        }
        else{

            const cleanWords = text.split(/[\s,.;:!?]+/);

            words.innerHTML = cleanWords.filter(item => item !== "").length;
        }
    
    })

}


// Grammar Enhancing Logic

async function EnhanceGrammar(){
    const text = input.value.trim();

    if (!text) {
        alert("Please enter text first.");
        return;
    }

    if (window.location.protocol === "file:") {
        alert("Please run npm start and open http://localhost:3000, not the file directly.");
        return;
    }

    if (isGitHubPages && !apiBase) {
        enhanceStatus.textContent = "Backend URL missing. Set meta[name='wordly-api-base'] for deployed frontend.";
        alert("Backend URL is not configured. Add your deployed backend URL to the wordly-api-base meta tag in index.html.");
        return;
    }

    const originalText = input.value;
    const oldButtonText = enhanceButton.textContent;
    enhanceButton.textContent = "Enhancing...";
    enhanceButton.classList.add("loading");
    enhanceButton.disabled = true;
    enhanceStatus.textContent = "Enhancing your text...";
    const endpoint = apiBase ? `${apiBase}/api/enhance` : "/api/enhance";

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text })
        });

        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("application/json")
            ? await response.json()
            : { error: await response.text() };

        if (!response.ok) {
            throw new Error(data.error || "Enhancement failed");
        }

        input.value = data.enhancedText;
        input.dispatchEvent(new Event("input"));

        if (data.enhancedText === originalText.trim()) {
            enhanceStatus.textContent = "No grammar changes were needed.";
        } else {
            enhanceStatus.textContent = "Grammar enhanced successfully.";
        }
    } catch (error) {
        const isNetworkError = error instanceof TypeError;
        if (isNetworkError) {
            enhanceStatus.textContent = `Cannot reach backend endpoint: ${endpoint}`;
            alert(`Could not reach backend endpoint: ${endpoint}`);
        } else {
            enhanceStatus.textContent = "Enhancement failed. Check server/API key.";
            alert(`Could not enhance grammar: ${error.message}`);
        }
        console.error(error);
    } finally {
        enhanceButton.textContent = oldButtonText;
        enhanceButton.classList.remove("loading");
        enhanceButton.disabled = false;
    }

}