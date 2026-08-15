const https = require('https');
const http = require('http');

/**
 * Translates a given text to Spanish using Google Translate free endpoint.
 * @param {string} text - Text to translate.
 * @param {string} targetLang - Target language code (default 'es').
 * @returns {Promise<string>} Translated text.
 */
async function translateText(text, targetLang = 'es') {
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
 * Helper function to fetch URL content via HTTPS/HTTP
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
 * Translates HTML content while preserving tags and code blocks.
 */
async function translateHtmlContent($, containerSelector = 'body') {
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

    console.log(`[Translator] Found ${textNodes.length} text nodes to translate.`);

    const chunkSize = 15;
    for (let i = 0; i < textNodes.length; i += chunkSize) {
        const batch = textNodes.slice(i, i + chunkSize);
        await Promise.all(batch.map(async (node) => {
            const original = node.data;
            const translated = await translateText(original, 'es');
            if (translated && translated !== original) {
                node.data = translated;
            }
        }));
    }
}

module.exports = {
    translateText,
    translateHtmlContent
};
