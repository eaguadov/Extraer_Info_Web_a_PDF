const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ─── Logging persistente ───
const LOG_DIR = path.join(__dirname, '../logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function getLogFilePath() {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return path.join(LOG_DIR, `translator_${date}.log`);
}

function logToFile(level, message) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level}] ${message}\n`;
    console.log(line.trim());
    try { fs.appendFileSync(getLogFilePath(), line); } catch {}
}

// ─── Constantes de control ───
const MAX_CHARS_PER_BATCH = 20000;  // ~5.000 tokens de entrada → salida < 8.192 tokens
const GEMINI_MIN_INTERVAL_MS = 4100; // Espaciado para respetar 15 RPM
let lastGeminiCallTimestamp = 0;

async function enforceGeminiRateLimit() {
    const elapsed = Date.now() - lastGeminiCallTimestamp;
    if (elapsed < GEMINI_MIN_INTERVAL_MS) {
        const delay = GEMINI_MIN_INTERVAL_MS - elapsed;
        logToFile('RATE', `Esperando ${(delay / 1000).toFixed(1)}s para respetar cuota 15 RPM`);
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    lastGeminiCallTimestamp = Date.now();
}

// ─── Google Translate (sin límites prácticos) ───
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
        logToFile('WARN', `Google Translate falló: ${err.message}`);
        return text;
    }
}

// ─── Helpers HTTP ───
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

// ─── Gemini 1.5 Flash: traduce un BLOQUE COMPLETO de texto en 1 petición ───
async function translateBatchGemini(textBlock, apiKey) {
    if (!apiKey) {
        throw new Error('No se proporcionó una Clave de API de Google Gemini.');
    }

    await enforceGeminiRateLimit();

    const charCount = textBlock.length;
    logToFile('GEMINI', `Enviando lote de ${charCount} caracteres (~${Math.round(charCount / 4)} tokens) a Gemini 1.5 Flash`);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const promptText = `Eres un traductor técnico profesional experto en documentación de software. Traduce TODO el siguiente texto al español.

REGLAS ESTRICTAS:
- Traduce TODAS las frases al español.
- NO traduzcas nombres de funciones, comandos de código, rutas de archivos ni variables.
- Conserva EXACTAMENTE los delimitadores |||SEP||| tal cual, sin modificarlos ni eliminarlos.
- Devuelve ÚNICAMENTE el texto traducido, sin explicaciones ni comentarios adicionales.

TEXTO A TRADUCIR:
${textBlock}`;

    const requestBody = JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192
        }
    });

    const responseText = await postJson(url, requestBody);
    const data = JSON.parse(responseText);

    if (data.error) {
        const errMsg = `Google Gemini Error (${data.error.code || 'API'}): ${data.error.message || 'Error desconocido'}`;
        logToFile('ERROR', errMsg);
        throw new Error(errMsg);
    }

    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
        const result = data.candidates[0].content.parts[0].text.trim();
        logToFile('GEMINI', `Respuesta recibida: ${result.length} caracteres traducidos`);
        return result;
    }
    throw new Error('La respuesta de Gemini no contenía texto traducido.');
}

// ─── Dispatcher principal ───
async function translateText(text, options = {}) {
    const engine = options.engine || 'google';
    const apiKey = options.geminiApiKey || process.env.GEMINI_API_KEY;

    if (engine === 'gemini' && apiKey) {
        // Para títulos sueltos, traducir directamente con 1 petición individual
        await enforceGeminiRateLimit();
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const promptText = `Traduce al español esta frase de documentación técnica. Devuelve SOLO la traducción:\n\n${text}`;
        const requestBody = JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 256 }
        });
        try {
            const responseText = await postJson(url, requestBody);
            const data = JSON.parse(responseText);
            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
                return data.candidates[0].content.parts[0].text.trim();
            }
        } catch (err) {
            logToFile('WARN', `Gemini falló para título, usando Google Translate: ${err.message}`);
        }
        return await translateTextGoogle(text, 'es');
    }
    return await translateTextGoogle(text, 'es');
}

// ─── Traducción HTML por LOTES AGRUPADOS (estrategia de batching) ───
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

    const totalNodes = textNodes.length;
    logToFile('INFO', `[${options.engine || 'google'}] ${totalNodes} nodos de texto encontrados para traducir`);

    if (options.engine === 'gemini' && options.geminiApiKey) {
        // ─── ESTRATEGIA POR LOTES: agrupar nodos hasta MAX_CHARS_PER_BATCH ───
        const SEPARATOR = '|||SEP|||';
        let batchTexts = [];
        let batchNodes = [];
        let batchCharCount = 0;
        let batchIndex = 0;
        let geminiFailedPermanently = false;

        for (let i = 0; i <= totalNodes; i++) {
            const isLast = (i === totalNodes);
            const nodeText = isLast ? '' : textNodes[i].data.trim();

            // Si al añadir este nodo se supera el límite, o es el último, enviar lote actual
            if ((batchCharCount + nodeText.length > MAX_CHARS_PER_BATCH && batchTexts.length > 0) || (isLast && batchTexts.length > 0)) {
                batchIndex++;
                const combinedText = batchTexts.join(` ${SEPARATOR} `);
                logToFile('BATCH', `Lote #${batchIndex}: ${batchTexts.length} nodos, ${batchCharCount} caracteres`);

                let translatedParts = null;

                if (!geminiFailedPermanently) {
                    try {
                        const translatedBlock = await translateBatchGemini(combinedText, options.geminiApiKey);
                        translatedParts = translatedBlock.split(SEPARATOR).map(s => s.trim());
                    } catch (err) {
                        logToFile('ERROR', `Lote #${batchIndex} falló con Gemini: ${err.message}`);

                        // Notificar al callback de progreso si existe
                        if (options.onGeminiFail) {
                            const decision = await options.onGeminiFail(err.message, batchIndex);
                            if (decision === 'fallback') {
                                logToFile('FALLBACK', `Usuario eligió continuar con Google Translate desde lote #${batchIndex}`);
                                geminiFailedPermanently = true;
                            }
                            // Si decision !== 'fallback', reintentamos abajo con Google Translate solo para este lote
                        } else {
                            // Sin callback, fallback automático para este lote
                            logToFile('FALLBACK', `Fallback automático a Google Translate para lote #${batchIndex}`);
                        }
                    }
                }

                // Aplicar traducciones a los nodos
                if (translatedParts && translatedParts.length === batchNodes.length) {
                    // Gemini devolvió el número correcto de partes
                    for (let j = 0; j < batchNodes.length; j++) {
                        if (translatedParts[j] && translatedParts[j] !== batchNodes[j].data.trim()) {
                            batchNodes[j].data = translatedParts[j];
                        }
                    }
                } else {
                    // Fallback: traducir cada nodo del lote individualmente con Google Translate
                    if (translatedParts) {
                        logToFile('WARN', `Lote #${batchIndex}: Gemini devolvió ${translatedParts.length} partes pero se esperaban ${batchNodes.length}. Usando Google Translate.`);
                    }
                    await Promise.all(batchNodes.map(async (node) => {
                        const original = node.data;
                        const translated = await translateTextGoogle(original, 'es');
                        if (translated && translated !== original) {
                            node.data = translated;
                        }
                    }));
                }

                // Reset del lote
                batchTexts = [];
                batchNodes = [];
                batchCharCount = 0;
            }

            // Acumular nodo actual en el lote (si no es el último ficticio)
            if (!isLast) {
                batchTexts.push(nodeText);
                batchNodes.push(textNodes[i]);
                batchCharCount += nodeText.length;
            }
        }

        logToFile('INFO', `Traducción Gemini completada: ${batchIndex} lotes procesados para ${totalNodes} nodos`);

    } else {
        // ─── Google Translate: procesamiento paralelo rápido ───
        const chunkSize = 15;
        for (let i = 0; i < totalNodes; i += chunkSize) {
            const batch = textNodes.slice(i, i + chunkSize);
            await Promise.all(batch.map(async (node) => {
                const original = node.data;
                const translated = await translateTextGoogle(original, 'es');
                if (translated && translated !== original) {
                    node.data = translated;
                }
            }));
        }
    }
}

module.exports = {
    translateText,
    translateHtmlContent,
    translateBatchGemini
};
