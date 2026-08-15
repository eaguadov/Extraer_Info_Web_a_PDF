document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const urlInput = document.getElementById('url-input');
    const btnDemo = document.getElementById('btn-demo');
    const maxDepthRange = document.getElementById('max-depth');
    const maxDepthVal = document.getElementById('max-depth-val');
    const maxPagesRange = document.getElementById('max-pages');
    const maxPagesVal = document.getElementById('max-pages-val');
    const chkTranslate = document.getElementById('chk-translate');
    const btnScan = document.getElementById('btn-scan');

    const stepInput = document.getElementById('step-input');
    const stepScanResults = document.getElementById('step-scan-results');
    const stepProgress = document.getElementById('step-progress');
    const stepSuccess = document.getElementById('step-success');

    const statTotalPages = document.getElementById('stat-total-pages');
    const statMaxDepth = document.getElementById('stat-max-depth');
    const statLang = document.getElementById('stat-lang');
    const pagesTreeList = document.getElementById('pages-tree-list');

    const btnSelectAll = document.getElementById('btn-select-all');
    const btnDeselectAll = document.getElementById('btn-deselect-all');
    const btnBackInput = document.getElementById('btn-back-input');
    const btnGenerate = document.getElementById('btn-generate');

    const progressFill = document.getElementById('progress-fill');
    const progressLog = document.getElementById('progress-log');
    const progressTitle = document.getElementById('progress-title');
    const progressDetail = document.getElementById('progress-detail');

    const resFilename = document.getElementById('res-filename');
    const resPagesCount = document.getElementById('res-pages-count');
    const btnDownload = document.getElementById('btn-download');
    const btnRestart = document.getElementById('btn-restart');

    let currentScanResult = null;

    // Sliders event listeners
    maxDepthRange.addEventListener('input', (e) => {
        maxDepthVal.textContent = `${e.target.value} ${e.target.value == 1 ? 'nivel' : 'niveles'}`;
    });

    maxPagesRange.addEventListener('input', (e) => {
        maxPagesVal.textContent = `${e.target.value} páginas`;
    });

    const selectEngine = document.getElementById('select-engine');
    const geminiKeyGroup = document.getElementById('gemini-key-group');
    const geminiApiKeyInput = document.getElementById('gemini-api-key');

    const btnTestKey = document.getElementById('btn-test-key');
    const geminiKeyStatus = document.getElementById('gemini-key-status');

    // Engine Selector listener
    if (selectEngine) {
        selectEngine.addEventListener('change', (e) => {
            if (e.target.value === 'gemini') {
                geminiKeyGroup.classList.remove('hidden');
            } else {
                geminiKeyGroup.classList.add('hidden');
            }
        });
    }

    // Test Gemini API Key button
    if (btnTestKey) {
        btnTestKey.addEventListener('click', async () => {
            const apiKey = geminiApiKeyInput ? geminiApiKeyInput.value.trim() : '';
            if (!apiKey) {
                geminiKeyStatus.innerHTML = '<span class="status-badge error">❌ Ingrese una Clave API para verificar.</span>';
                geminiKeyStatus.classList.remove('hidden');
                return;
            }

            btnTestKey.disabled = true;
            btnTestKey.textContent = 'Verificando...';
            geminiKeyStatus.classList.add('hidden');

            try {
                const res = await fetch('/api/verify-gemini-key', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey })
                });

                const data = await res.json();
                geminiKeyStatus.classList.remove('hidden');

                if (res.ok && data.valid) {
                    geminiKeyStatus.innerHTML = '<span class="status-badge success">🟢 Clave de API Verificada y Conectada con Éxito (Google Gemini 1.5 Flash).</span>';
                } else {
                    geminiKeyStatus.innerHTML = `<span class="status-badge error">❌ Error de Conexión: ${escapeHtml(data.error || 'Clave no válida')}</span>`;
                }
            } catch (err) {
                geminiKeyStatus.classList.remove('hidden');
                geminiKeyStatus.innerHTML = `<span class="status-badge error">❌ Fallo de verificación: ${escapeHtml(err.message)}</span>`;
            } finally {
                btnTestKey.disabled = false;
                btnTestKey.textContent = 'Probar Clave';
            }
        });
    }

    // Demo URL button
    btnDemo.addEventListener('click', () => {
        urlInput.value = 'https://antigravity.google/docs/getting-started';
    });

    // Step 1: Pre-Scan Request
    btnScan.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) {
            alert('Por favor ingresa una URL válida.');
            return;
        }

        const scopeMode = document.querySelector('input[name="scopeMode"]:checked').value;
        const maxDepth = maxDepthRange.value;
        const maxPagesCap = maxPagesRange.value;

        btnScan.disabled = true;
        btnScan.textContent = 'Analizando estructura web...';

        try {
            const response = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, scopeMode, maxDepth, maxPagesCap })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Error al escanear la URL');
            }

            currentScanResult = await response.json();
            renderScanResults(currentScanResult);

            stepInput.classList.add('hidden');
            stepScanResults.classList.remove('hidden');
        } catch (err) {
            alert(`Error de inspección: ${err.message}`);
        } finally {
            btnScan.disabled = false;
            btnScan.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Analizar e Inspeccionar Estructura`;
        }
    });

    // Render tree list with checkboxes
    function renderScanResults(scanData) {
        statTotalPages.textContent = scanData.totalPages;
        statMaxDepth.textContent = `${scanData.maxDepth} ${scanData.maxDepth === 1 ? 'nivel' : 'niveles'}`;
        statLang.textContent = (scanData.detectedLanguage || 'es').toUpperCase();

        pagesTreeList.innerHTML = '';

        if (!scanData.pages || scanData.pages.length === 0) {
            pagesTreeList.innerHTML = '<p style="padding: 12px; color: #64748b;">No se encontraron páginas accesibles.</p>';
            return;
        }

        scanData.pages.forEach((page, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = `tree-item depth-${Math.min(page.depth, 3)}`;
            itemDiv.innerHTML = `
                <input type="checkbox" id="chk-page-${index}" data-url="${escapeAttr(page.url)}" data-title="${escapeAttr(page.title)}" data-depth="${page.depth}" checked>
                <label for="chk-page-${index}">
                    <strong>${escapeHtml(page.title || page.url)}</strong>
                </label>
                <span class="tree-item-url">${escapeHtml(page.url)}</span>
            `;
            pagesTreeList.appendChild(itemDiv);
        });
    }

    // Select/Deselect All buttons
    btnSelectAll.addEventListener('click', () => {
        document.querySelectorAll('#pages-tree-list input[type="checkbox"]').forEach(chk => chk.checked = true);
    });

    btnDeselectAll.addEventListener('click', () => {
        document.querySelectorAll('#pages-tree-list input[type="checkbox"]').forEach(chk => chk.checked = false);
    });

    // Back button
    btnBackInput.addEventListener('click', () => {
        stepScanResults.classList.add('hidden');
        stepInput.classList.remove('hidden');
    });

    // Step 2: Generate PDF Request
    btnGenerate.addEventListener('click', async () => {
        const selectedCheckboxes = document.querySelectorAll('#pages-tree-list input[type="checkbox"]:checked');
        if (selectedCheckboxes.length === 0) {
            alert('Por favor selecciona al menos una página para compilar en el PDF.');
            return;
        }

        const selectedPages = Array.from(selectedCheckboxes).map(chk => ({
            url: chk.dataset.url,
            title: chk.dataset.title,
            depth: parseInt(chk.dataset.depth || 0)
        }));

        const translateToSpanish = chkTranslate.checked;
        const translatorEngine = selectEngine ? selectEngine.value : 'google';
        const geminiApiKey = geminiApiKeyInput ? geminiApiKeyInput.value.trim() : '';
        const mainTitle = selectedPages[0] ? selectedPages[0].title : 'Documentación Web';
        const rootUrl = urlInput.value.trim();

        // Switch to progress view
        stepScanResults.classList.add('hidden');
        stepProgress.classList.remove('hidden');

        progressFill.style.width = '10%';
        progressLog.textContent = `Iniciando crawler (Motor: ${translatorEngine === 'gemini' ? 'Google Gemini IA' : 'Google Translate'})...`;

        // Simulate progress bar movement
        let progressVal = 15;
        const progressTimer = setInterval(() => {
            if (progressVal < 85) {
                progressVal += Math.floor(Math.random() * 8) + 2;
                progressFill.style.width = `${progressVal}%`;
                if (progressVal > 40 && translateToSpanish) {
                    progressLog.textContent = translatorEngine === 'gemini' 
                        ? 'Traduciendo con IA de Google Gemini 1.5 Flash...' 
                        : 'Traduciendo contenidos al español y preservando código...';
                } else if (progressVal > 70) {
                    progressLog.textContent = 'Generando Índice navegable y maquetando PDF en A4...';
                }
            }
        }, 1200);

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pages: selectedPages,
                    rootUrl,
                    mainTitle,
                    translateToSpanish,
                    translatorEngine,
                    geminiApiKey
                })
            });

            clearInterval(progressTimer);

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Error al compilar el PDF');
            }

            const result = await response.json();
            progressFill.style.width = '100%';

            setTimeout(() => {
                stepProgress.classList.add('hidden');
                stepSuccess.classList.remove('hidden');

                resFilename.textContent = result.filename;
                resPagesCount.textContent = `${selectedPages.length} secciones compiladas`;
                btnDownload.href = result.downloadUrl;
            }, 500);

        } catch (err) {
            clearInterval(progressTimer);
            stepProgress.classList.add('hidden');

            const isGeminiError = translatorEngine === 'gemini' || err.message.toLowerCase().includes('gemini');

            if (isGeminiError) {
                // Show Gemini Error Modal with exact message
                const modal = document.getElementById('gemini-error-modal');
                const errorMsgDiv = document.getElementById('gemini-error-msg');
                const btnRetry = document.getElementById('btn-retry-gemini');
                const btnFallback = document.getElementById('btn-fallback-google');

                errorMsgDiv.textContent = err.message;
                modal.classList.remove('hidden');

                // Option 1: Retry with Gemini
                btnRetry.onclick = () => {
                    modal.classList.add('hidden');
                    btnGenerate.click(); // Re-trigger generate
                };

                // Option 2: Fallback to Google Translate
                btnFallback.onclick = () => {
                    modal.classList.add('hidden');
                    if (selectEngine) selectEngine.value = 'google';
                    if (geminiKeyGroup) geminiKeyGroup.classList.add('hidden');
                    btnGenerate.click(); // Re-trigger generate with Google Translate
                };
            } else {
                alert(`Error durante la generación: ${err.message}`);
                stepScanResults.classList.remove('hidden');
            }
        }
    });

    // Restart button
    btnRestart.addEventListener('click', () => {
        stepSuccess.classList.add('hidden');
        stepInput.classList.remove('hidden');
    });

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function escapeAttr(str) {
        if (!str) return '';
        return String(str).replace(/"/g, '&quot;');
    }
});
