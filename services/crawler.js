const { chromium } = require('playwright');
const cheerio = require('cheerio');
const { translateHtmlContent, translateText } = require('./translator');

/**
 * Normalizes a URL by removing hashes and trailing slashes.
 */
function normalizeUrl(rawUrl, baseUrl) {
    try {
        const parsed = new URL(rawUrl, baseUrl);
        parsed.hash = ''; // remove anchor
        let href = parsed.href;
        if (href.endsWith('/') && href.length > parsed.origin.length + 1) {
            href = href.slice(0, -1);
        }
        return href;
    } catch {
        return null;
    }
}

/**
 * Checks if a candidate URL belongs to the allowed scope.
 * @param {string} candidateUrl
 * @param {string} startUrl
 * @param {'subpath' | 'domain'} scopeMode
 */
function isUrlInScope(candidateUrl, startUrl, scopeMode) {
    try {
        const candidate = new URL(candidateUrl);
        const start = new URL(startUrl);

        if (candidate.hostname !== start.hostname) {
            return false;
        }

        if (scopeMode === 'subpath') {
            // Get base path up to the last folder or starting path
            const startBasePath = start.pathname.slice(0, start.pathname.lastIndexOf('/') + 1);
            return candidate.pathname.startsWith(startBasePath) || candidate.pathname.startsWith(start.pathname);
        }

        return true;
    } catch {
        return false;
    }
}

/**
 * Fast scan of domain structure to discover pages, estimate depth levels and total pages.
 */
async function scanDomainStructure(startUrl, scopeMode = 'subpath', maxDepth = 3, maxPagesCap = 1000) {
    const normalizedStart = normalizeUrl(startUrl);
    if (!normalizedStart) throw new Error('URL inválida');

    const visited = new Set();
    const queue = [{ url: normalizedStart, depth: 0 }];
    const tree = [];
    let detectedLang = 'en';

    let browser = null;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        while (queue.length > 0 && visited.size < maxPagesCap) {
            const current = queue.shift();
            if (visited.has(current.url)) continue;
            visited.add(current.url);

            let title = current.url;
            let foundLinks = [];

            try {
                // Fetch page HTML quickly
                const res = await page.goto(current.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                if (res && res.status() === 200) {
                    const html = await page.content();
                    const $ = cheerio.load(html);

                    if (visited.size === 1) {
                        const htmlLang = $('html').attr('lang');
                        if (htmlLang) detectedLang = htmlLang.split('-')[0].toLowerCase();
                    }

                    title = $('title').text().trim() || $('h1').first().text().trim() || current.url;

                    if (current.depth < maxDepth) {
                        $('a[href]').each((_, el) => {
                            const rawHref = $(el).attr('href');
                            const absUrl = normalizeUrl(rawHref, current.url);
                            if (absUrl && isUrlInScope(absUrl, normalizedStart, scopeMode) && !visited.has(absUrl)) {
                                foundLinks.push(absUrl);
                            }
                        });
                    }
                }
            } catch (err) {
                console.warn(`[Scan] Could not scan ${current.url}:`, err.message);
            }

            tree.push({
                url: current.url,
                title: title,
                depth: current.depth
            });

            for (const link of foundLinks) {
                if (!visited.has(link) && !queue.some(q => q.url === link)) {
                    queue.push({ url: link, depth: current.depth + 1 });
                }
            }
        }

        await browser.close();

        // Calculate statistics
        const maxDiscoveredDepth = Math.max(...tree.map(t => t.depth), 0);
        return {
            startUrl: normalizedStart,
            scopeMode,
            totalPages: tree.length,
            maxDepth: maxDiscoveredDepth,
            detectedLanguage: detectedLang,
            pages: tree
        };
    } catch (err) {
        if (browser) await browser.close();
        throw err;
    }
}

/**
 * Extracts and cleans content from selected pages, optionally translating to Spanish.
 */
async function extractPagesContent(pagesToExtract, options = {}, onProgress = () => {}) {
    const translateToSpanish = options.translateToSpanish !== false;
    let browser = null;
    const extractedData = [];

    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        const total = pagesToExtract.length;
        for (let i = 0; i < total; i++) {
            const item = pagesToExtract[i];
            onProgress({ current: i + 1, total, url: item.url, title: item.title, step: 'crawling' });

            try {
                await page.goto(item.url, { waitUntil: 'networkidle', timeout: 25000 });
                const rawHtml = await page.content();
                const $ = cheerio.load(rawHtml);

                // Convert relative URLs for images and resources to absolute
                $('img').each((_, img) => {
                    const src = $(img).attr('src');
                    if (src) {
                        try {
                            $(img).attr('src', new URL(src, item.url).href);
                        } catch {}
                    }
                });

                // Remove unwanted elements: nav, footer, sidebar, ads, scripts
                $('nav, header, footer, script, style, noscript, iframe, .sidebar, .menu, .cookie-banner, .advertisement, #header, #footer').remove();

                // Locate main content section
                let $content = $('main, article, [role="main"], #content, .content, .documentation, .docs-content').first();
                if (!$content || $content.length === 0) {
                    $content = $('body');
                }

                // Extract Page Title
                let pageTitle = $('h1').first().text().trim();
                if (!pageTitle) pageTitle = $('title').text().trim() || item.title || item.url;

                // Translate text nodes inside $content to Spanish if enabled
                if (translateToSpanish) {
                    onProgress({ current: i + 1, total, url: item.url, title: pageTitle, step: 'translating' });
                    const transOpts = { engine: options.translatorEngine, geminiApiKey: options.geminiApiKey };
                    pageTitle = await translateText(pageTitle, transOpts);
                    await translateHtmlContent($, $content, transOpts);
                }

                // Clean up headings and assign IDs for Table of Contents anchors
                const pageHeadingId = `page-sec-${i + 1}`;
                const innerHeadings = [];

                $content.find('h1, h2, h3').each((hIdx, elem) => {
                    const $h = $(elem);
                    const tag = elem.tagName.toLowerCase();
                    const text = $h.text().trim();
                    const subId = `${pageHeadingId}-sub-${hIdx}`;
                    $h.attr('id', subId);

                    innerHeadings.push({
                        level: tag,
                        text,
                        id: subId
                    });
                });

                extractedData.push({
                    index: i + 1,
                    headingId: pageHeadingId,
                    title: pageTitle,
                    url: item.url,
                    depth: item.depth || 0,
                    contentHtml: $content.html() || '',
                    innerHeadings
                });

            } catch (pageErr) {
                console.error(`[Extractor] Error processing ${item.url}:`, pageErr.message);
                extractedData.push({
                    index: i + 1,
                    headingId: `page-sec-${i + 1}`,
                    title: item.title || item.url,
                    url: item.url,
                    depth: item.depth || 0,
                    contentHtml: `<div class="error-notice"><p><em>No se pudo extraer el contenido de esta página. (Error: ${pageErr.message})</em></p></div>`,
                    innerHeadings: []
                });
            }
        }

        await browser.close();
        return extractedData;
    } catch (err) {
        if (browser) await browser.close();
        throw err;
    }
}

module.exports = {
    scanDomainStructure,
    extractPagesContent
};
