const https = require('https');
const http = require('http');

let lastGeminiCallTimestamp = 0;

/**
 * Ensures Gemini API calls stay within the Free Tier 15 RPM limit (15 requests/min).
 * Spaces calls by at least 4.1 seconds.
 */
async function enforceGeminiRateLimit() {
    const now = Date.now();
    const minIntervalMs = 4100; // 4.1s = ~14.6 calls per minute max
    const elapsed = now - lastGeminiCallTimestamp;
    
    if (elapsed < minIntervalMs) {
        const delay = minIntervalMs - elapsed;
        console.log(`[Rate Limiter Gemini] Espaciando petición (${(delay / 1000).toFixed(1)}s) para respetar cuota gratuita (15 RPM)...`);
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    lastGeminiCallTimestamp = Date.now();
}

/**
 * Translates a text string using Google Translate free endpoint.
 */
async function translateTextGoogle(text, targetLang = 'es') {
    if (!text || typeof text !== 'string' || !text.trim()) return text;
    if (/^[\d\s\W]+$/.test(text)) return text;

    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetchUrl(url);
        const data = JSON.parse(response);

        if (data && data[0]) {
            return data[0].map(item => item[0]).filter(Boolean).join('') || text;
        }
        return text;
    } catch (err) {
        console.warn(`[Translator Google] Warning:`, err.message);
        return text;
    }
}

/**
 * Translates a text string using Google Gemini 1.5 Flash API with rate limiting.
 */
async function translateTextGemini(text, apiKey, targetLang = 'es') {
    if (!text || typeof text !== 'string' || !text.trim()) return text;
    if (/^[\d\s\W]+$/.test(text)) return text;
    
    if (!apiKey) {
        throw new Error('No se proporcionó una Clave de API de Google Gemini (GEMINI_API_KEY). Por favor ingresa tu API Key o selecciona Google Translate.');
    }

    // Enforce 15 RPM Rate Limit
    await enforceGeminiRateLimit();

    console.log(`🤖 [MOTOR GEMINI IA] Enviando fragmento a Gemini 1.5 Flash API...`);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const promptText = `Eres un traductor técnico profesional experto en programación y documentación de software. Traduce el siguiente fragmento al español manteniendo la coherencia técnica, la puntuación y el formato. No traduzcas comandos de código ni nombres de funciones. Devuelve ÚNICAMENTE el texto traducido sin explicaciones adicionales:\n\n${text}`;

    const requestBody = JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048
        }
    });

    try {
        const responseText = await postJson(url, requestBody);
        const data = JSON.parse(responseText);

        if (data.error) {
            throw new Error(`Google Gemini Error (${data.error.code || 'API'}): ${data.error.message || 'Error en la petición de traducción'}`);
        }

        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
            const translatedStr = data.candidates[0].content.parts[0].text.trim();
            return translatedStr || text;
        }
        return text;
    } catch (err) {
        throw new Error(`Fallo en traducción con Gemini 1.5: ${err.message}`);
    }
}

/**
 * General translation function dispatcher
 */
async function translateText(text, options = {}) {
    const engine = options.engine || 'google';
    const apiKey = options.geminiApiKey || process.env.GEMINI_API_KEY;

    if (engine === 'gemini') {
        return await translateTextGemini(text, apiKey, 'es');
    }
    return await translateTextGoogle(text, 'es');
}

/**
 * Helper function to fetch URL content via HTTPS GET
 */
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        }).on('error', reject);
    });
}

/**
 * Helper function to post JSON content via HTTPS POST
 */
function postJson(urlString, jsonPayload) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(urlString);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(jsonPayload)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    try {
                        const parsedErr = JSON.parse(data);
                        if (parsedErr && parsedErr.error) {
                            reject(new Error(`[${res.statusCode}] ${parsedErr.error.message || 'Error de API'}`));
                            return;
                        }
                    } catch {}
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.write(jsonPayload);
        req.end();
    });
}

/**
 * Translates HTML content while preserving tags and code blocks.
 * Bundles texts to minimize API requests and enforces rate limiting.
 */
async function translateHtmlContent($, containerSelector = 'body', options = {}) {
    const textNodes = [];

    $(containerSelector).find('*').each((_, elem) => {
        const tagName = elem.tagName ? elem.tagName.toLowerCase() : '';
        if (['script', 'style', 'code', 'pre', 'svg', 'noscript', 'iframe'].includes(tagName)) {
            return;
        }

        $(elem).contents().each((_, child) => {
            if (child.type === 'text') {
                const nodeText = child.data ? child.data.trim() : '';
                if (nodeText.length > 2 && /[a-zA-Z]/.test(nodeText)) {
                    textNodes.push(child);
                }
            }
        });
    });

    console.log(`[Translator - ${options.engine || 'google'}] Translating ${textNodes.length} text nodes...`);

    // For Gemini, process sequentially in blocks of 6 nodes to strictly enforce 15 RPM
    // For Google Translate, process in parallel chunks of 15
    if (options.engine === 'gemini') {
        const chunkSize = 6;
        for (let i = 0; i < textNodes.length; i += chunkSize) {
            const batch = textNodes.slice(i, i + chunkSize);
            for (const node of batch) {
                const original = node.data;
                const translated = await translateText(original, options);
                if (translated && translated !== original) {
                    node.data = translated;
                }
            }
        }
    } else {
        const chunkSize = 15;
        for (let i = 0; i < textNodes.length; i += chunkSize) {
            const batch = textNodes.slice(i, i + chunkSize);
            await Promise.all(batch.map(async (node) => {
                const original = node.data;
                const translated = await translateText(original, options);
                if (translated && translated !== original) {
                    node.data = translated;
                }
            }));
        }
    }
}

module.exports = {
    translateText,
    translateHtmlContent
};
