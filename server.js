const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { scanDomainStructure, extractPagesContent } = require('./services/crawler');
const { generatePDF } = require('./services/pdfBuilder');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure output directory exists
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}
/**
 * Check if Gemini API Key is configured in server environment variables
 */
app.get('/api/check-gemini-config', (req, res) => {
    const hasKey = !!process.env.GEMINI_API_KEY;
    res.json({ hasKey });
});

/**
 * Verify Gemini API Key
 */
app.post('/api/verify-gemini-key', async (req, res) => {
    try {
        const { apiKey } = req.body;
        const keyToVerify = apiKey || process.env.GEMINI_API_KEY;

        if (!keyToVerify) {
            return res.status(400).json({ valid: false, error: 'No se ha proporcionado ninguna Clave de API' });
        }

        const { translateText } = require('./services/translator');
        const result = await translateText('Hello', { engine: 'gemini', geminiApiKey: keyToVerify });
        res.json({ valid: true, testTranslation: result });
    } catch (err) {
        res.status(400).json({ valid: false, error: err.message });
    }
});

/**
 * Step 1: Pre-scan URL to discover structure and page count
 */
app.post('/api/scan', async (req, res) => {
    try {
        const { url, scopeMode = 'subpath', maxDepth = 3, maxPagesCap = 1000 } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'Debes proporcionar una URL válida' });
        }

        console.log(`[API /scan] Scanning URL: ${url} (Scope: ${scopeMode})`);
        const scanResult = await scanDomainStructure(url, scopeMode, parseInt(maxDepth), parseInt(maxPagesCap));
        res.json(scanResult);
    } catch (err) {
        console.error('[API /scan Error]', err);
        res.status(500).json({ error: err.message || 'Error al escanear la estructura web' });
    }
});

/**
 * Step 2: Crawl selected pages, translate to Spanish, compile & generate PDF
 */
app.post('/api/generate', async (req, res) => {
    try {
        const { pages, rootUrl, mainTitle, translateToSpanish = true, translatorEngine = 'google', geminiApiKey = '' } = req.body;
        
        if (!pages || !Array.isArray(pages) || pages.length === 0) {
            return res.status(400).json({ error: 'Debes seleccionar al menos una página para compilar' });
        }

        console.log(`[API /generate] Extracting ${pages.length} pages (Translate: ${translateToSpanish}, Engine: ${translatorEngine})...`);
        
        // Extract content from selected pages with real-time status logging
        const extractedPages = await extractPagesContent(pages, { translateToSpanish, translatorEngine, geminiApiKey }, (progress) => {
            console.log(`[Progress] (${progress.current}/${progress.total}) [${progress.step}] ${progress.title}`);
        });

        // Generate PDF
        console.log('[API /generate] Building PDF document...');
        const { filename } = await generatePDF(extractedPages, {
            mainTitle: mainTitle || 'Documentación Compilada Web',
            rootUrl: rootUrl || (pages[0] ? pages[0].url : '')
        });

        res.json({
            success: true,
            downloadUrl: `/api/download/${filename}`,
            filename
        });
    } catch (err) {
        console.error('[API /generate Error]', err);
        res.status(500).json({ error: err.message || 'Error al compilar el PDF' });
    }
});

/**
 * Download generated PDF file
 */
app.get('/api/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(outputDir, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Archivo no encontrado');
    }

    res.download(filePath, filename);
});

/**
 * View translation logs (latest log file)
 */
app.get('/api/logs', (req, res) => {
    try {
        const logsDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logsDir)) {
            return res.json({ logs: [], message: 'Sin logs disponibles' });
        }

        const logFiles = fs.readdirSync(logsDir)
            .filter(f => f.endsWith('.log'))
            .sort()
            .reverse();

        if (logFiles.length === 0) {
            return res.json({ logs: [], message: 'Sin logs disponibles' });
        }

        const latestLog = fs.readFileSync(path.join(logsDir, logFiles[0]), 'utf-8');
        const lines = latestLog.trim().split('\n').filter(Boolean);
        
        res.json({
            filename: logFiles[0],
            totalLines: lines.length,
            logs: lines.slice(-200) // Últimas 200 líneas
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Servidor Web-to-PDF listo en http://localhost:${PORT}`);
    console.log(`====================================================`);
});
