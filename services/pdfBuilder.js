const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

/**
 * Builds an HTML document with professional print CSS and Table of Contents, then renders it to PDF using Playwright.
 * @param {Array} pagesData - Array of extracted page objects.
 * @param {Object} options - PDF compilation options (mainTitle, rootUrl, outputPath).
 * @returns {Promise<string>} Path to generated PDF file.
 */
async function generatePDF(pagesData, options = {}) {
    const mainTitle = options.mainTitle || 'Documentación Compilada Web';
    const rootUrl = options.rootUrl || '';
    const outputDir = path.join(__dirname, '../output');
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `documento_compilado_${Date.now()}.pdf`;
    const pdfPath = path.join(outputDir, filename);

    // Build Table of Contents HTML
    let tocHtml = `
    <div class="page cover-page">
        <div class="cover-content">
            <div class="badge">Documento PDF Compilado</div>
            <h1 class="cover-title">${escapeHtml(mainTitle)}</h1>
            <p class="cover-subtitle">Extracción completa de sitio web en español</p>
            <div class="cover-meta">
                <div class="meta-item"><strong>Fuente Original:</strong> <a href="${rootUrl}" target="_blank">${escapeHtml(rootUrl)}</a></div>
                <div class="meta-item"><strong>Total Páginas Compiladas:</strong> ${pagesData.length}</div>
                <div class="meta-item"><strong>Fecha de Generación:</strong> ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
        </div>
    </div>
    
    <div class="page page-break">
        <h2 class="toc-heading">Índice de Contenidos</h2>
        <ul class="toc-list">
    `;

    pagesData.forEach((page, idx) => {
        tocHtml += `
            <li class="toc-item toc-depth-${page.depth || 0}">
                <div class="toc-row">
                    <a href="#${page.headingId}" class="toc-title-link">${idx + 1}. ${escapeHtml(page.title)}</a>
                    <span class="toc-dots"></span>
                </div>
        `;

        if (page.innerHeadings && page.innerHeadings.length > 0) {
            tocHtml += `<ul class="toc-sublist">`;
            page.innerHeadings.forEach((sub, sIdx) => {
                if (sub.level === 'h2' || sub.level === 'h3') {
                    tocHtml += `
                        <li class="toc-subitem ${sub.level}">
                            <a href="#${sub.id}">${idx + 1}.${sIdx + 1} ${escapeHtml(sub.text)}</a>
                        </li>
                    `;
                }
            });
            tocHtml += `</ul>`;
        }

        tocHtml += `</li>`;
    });

    tocHtml += `
        </ul>
    </div>
    `;

    // Build Content Sections HTML
    let sectionsHtml = '';
    pagesData.forEach((page, idx) => {
        sectionsHtml += `
        <section class="page page-break article-section" id="${page.headingId}">
            <div class="section-header-banner">
                <span class="section-number">Sección ${idx + 1}</span>
                <span class="section-url">${escapeHtml(page.url)}</span>
            </div>
            <h1 class="page-main-title">${escapeHtml(page.title)}</h1>
            <div class="extracted-content">
                ${page.contentHtml}
            </div>
        </section>
        `;
    });

    // Assemble complete HTML document with Embedded Print CSS
    const completeHtml = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>${escapeHtml(mainTitle)}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
        <style>
            * {
                box-sizing: border-box;
            }
            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                color: #1e293b;
                line-height: 1.6;
                font-size: 13px;
                margin: 0;
                padding: 0;
                background-color: #ffffff;
            }

            .page-break {
                page-break-before: always;
                break-before: page;
            }

            /* Cover Page */
            .cover-page {
                display: flex;
                flex-direction: column;
                justify-content: center;
                min-height: 90vh;
                padding: 40px 20px;
            }
            .cover-content {
                border-left: 6px solid #2563eb;
                padding-left: 28px;
            }
            .badge {
                display: inline-block;
                background-color: #eff6ff;
                color: #2563eb;
                font-weight: 600;
                font-size: 12px;
                padding: 4px 12px;
                border-radius: 12px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 16px;
            }
            .cover-title {
                font-size: 32px;
                font-weight: 800;
                color: #0f172a;
                margin: 0 0 12px 0;
                line-height: 1.2;
            }
            .cover-subtitle {
                font-size: 16px;
                color: #64748b;
                margin: 0 0 32px 0;
            }
            .cover-meta {
                background: #f8fafc;
                border-radius: 8px;
                padding: 20px;
                border: 1px solid #e2e8f0;
            }
            .meta-item {
                font-size: 13px;
                color: #475569;
                margin-bottom: 8px;
            }
            .meta-item:last-child {
                margin-bottom: 0;
            }
            .meta-item a {
                color: #2563eb;
                text-decoration: none;
            }

            /* Table of Contents */
            .toc-heading {
                font-size: 24px;
                font-weight: 700;
                color: #0f172a;
                border-bottom: 2px solid #e2e8f0;
                padding-bottom: 10px;
                margin-top: 0;
            }
            .toc-list, .toc-sublist {
                list-style: none;
                padding-left: 0;
                margin: 0;
            }
            .toc-item {
                margin-bottom: 12px;
            }
            .toc-row {
                display: flex;
                align-items: baseline;
            }
            .toc-title-link {
                font-weight: 600;
                font-size: 14px;
                color: #1e293b;
                text-decoration: none;
            }
            .toc-title-link:hover {
                color: #2563eb;
            }
            .toc-dots {
                flex-grow: 1;
                border-bottom: 1px dashed #cbd5e1;
                margin: 0 8px;
            }
            .toc-sublist {
                padding-left: 20px;
                margin-top: 6px;
            }
            .toc-subitem {
                margin-bottom: 4px;
            }
            .toc-subitem a {
                font-size: 12px;
                color: #475569;
                text-decoration: none;
            }

            /* Article Sections */
            .article-section {
                padding-top: 10px;
            }
            .section-header-banner {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                color: #64748b;
                border-bottom: 1px solid #f1f5f9;
                padding-bottom: 6px;
                margin-bottom: 16px;
            }
            .section-number {
                font-weight: 700;
                color: #2563eb;
                text-transform: uppercase;
            }
            .page-main-title {
                font-size: 22px;
                font-weight: 700;
                color: #0f172a;
                margin-top: 0;
                margin-bottom: 20px;
            }

            /* Extracted HTML Elements Formatting */
            .extracted-content h1, .extracted-content h2, .extracted-content h3 {
                color: #0f172a;
                margin-top: 24px;
                margin-bottom: 12px;
                line-height: 1.3;
            }
            .extracted-content h2 { font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
            .extracted-content h3 { font-size: 15px; }

            .extracted-content p {
                margin-bottom: 14px;
            }
            .extracted-content a {
                color: #2563eb;
                text-decoration: none;
            }
            .extracted-content img {
                max-width: 100%;
                height: auto;
                border-radius: 6px;
                margin: 16px 0;
                box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            }
            .extracted-content code {
                font-family: 'Fira Code', monospace;
                background-color: #f1f5f9;
                color: #0f172a;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 12px;
            }
            .extracted-content pre {
                background-color: #0f172a;
                color: #f8fafc;
                padding: 16px;
                border-radius: 8px;
                overflow-x: auto;
                white-space: pre-wrap;
                word-break: break-all;
                font-family: 'Fira Code', monospace;
                font-size: 11.5px;
                line-height: 1.5;
            }
            .extracted-content pre code {
                background: transparent;
                color: inherit;
                padding: 0;
            }
            .extracted-content table {
                width: 100%;
                border-collapse: collapse;
                margin: 16px 0;
            }
            .extracted-content th, .extracted-content td {
                border: 1px solid #e2e8f0;
                padding: 8px 12px;
                text-align: left;
                font-size: 12px;
            }
            .extracted-content th {
                background-color: #f8fafc;
                font-weight: 600;
            }
            .extracted-content blockquote {
                border-left: 4px solid #3b82f6;
                background-color: #eff6ff;
                margin: 16px 0;
                padding: 12px 18px;
                color: #1e3a8a;
                border-radius: 0 6px 6px 0;
            }
            .error-notice {
                background-color: #fef2f2;
                border: 1px solid #fecaca;
                color: #991b1b;
                padding: 12px 16px;
                border-radius: 6px;
            }

            @media print {
                body {
                    background-color: #ffffff;
                }
                .page-break {
                    page-break-before: always;
                    break-before: page;
                }
            }
        </style>
    </head>
    <body>
        ${tocHtml}
        ${sectionsHtml}
    </body>
    </html>
    `;

    // Render HTML to PDF using Playwright
    let browser = null;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ javaScriptEnabled: false });
        const page = await context.newPage();
        await page.setContent(completeHtml, { waitUntil: 'networkidle' });

        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                bottom: '25mm',
                left: '18mm',
                right: '18mm'
            },
            displayHeaderFooter: true,
            headerTemplate: `
                <div style="font-size: 9px; font-family: sans-serif; color: #94a3b8; width: 100%; text-align: right; padding-right: 18mm;">
                    <span>${escapeHtml(mainTitle)}</span>
                </div>
            `,
            footerTemplate: `
                <div style="font-size: 9px; font-family: sans-serif; color: #94a3b8; width: 100%; display: flex; justify-content: space-between; padding: 0 18mm;">
                    <span>Fuente: ${escapeHtml(rootUrl)}</span>
                    <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
                </div>
            `
        });

        await browser.close();
        return { pdfPath, filename };
    } catch (err) {
        if (browser) await browser.close();
        throw err;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

module.exports = {
    generatePDF
};
