(function () {
    'use strict';

    var STORAGE_KEY = 'chum_app_v1';
    var APP_VERSION = 'chum_v3.3';
    var APP_NAME = 'image_tool_app';

    var state = {
        version: APP_VERSION,
        app: APP_NAME,
        theme: 'dark',
        data: [],
        meta: {
            created_at: '',
            updated_at: ''
        }
    };

    var originalImage = null;
    var currentCanvas = null;
    var currentCtx = null;
    var processingCanvas = null;
    var processingCtx = null;

    var settings = {
        brightness: 0,
        contrast: 0,
        shadows: 0,
        highlights: 0,
        smoothing: 0,
        sharpness: 0
    };

    function init() {
        loadState();
        applyTheme();
        render();
        bindEvents();
        registerServiceWorker();
    }

    function loadState() {
        try {
            var saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                var parsed = JSON.parse(saved);
                if (parsed.version === APP_VERSION && parsed.app === APP_NAME) {
                    state = parsed;
                }
            }
        } catch (e) {
            console.warn('Failed to load state:', e);
        }
        if (!state.meta.created_at) {
            state.meta.created_at = new Date().toISOString();
        }
    }

    function saveState() {
        state.meta.updated_at = new Date().toISOString();
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn('Failed to save state:', e);
        }
    }

    function render() {
        var themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.textContent = state.theme === 'dark' ? '☀️' : '🌙';
        }
        updateUIState();
    }

    function bindEvents() {
        document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
        document.getElementById('btn-theme-system').addEventListener('click', toggleTheme);

        var uploadArea = document.getElementById('upload-area');
        var fileInput = document.getElementById('file-input');

        uploadArea.addEventListener('click', function () { fileInput.click(); });
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handleDrop);
        fileInput.addEventListener('change', handleFileSelect);

        var sliderNames = ['brightness', 'contrast', 'shadows', 'highlights', 'smoothing', 'sharpness'];
        sliderNames.forEach(function (name) {
            var slider = document.getElementById('slider-' + name);
            var valueDisplay = document.getElementById('value-' + name);
            if (slider) {
                slider.addEventListener('input', function () {
                    settings[name] = parseInt(slider.value);
                    if (valueDisplay) valueDisplay.textContent = slider.value;
                });
            }
        });

        document.getElementById('btn-apply').addEventListener('click', applyProcessing);
        document.getElementById('btn-download').addEventListener('click', downloadImage);

        document.getElementById('preset-facebook').addEventListener('click', presetFacebook);
        document.getElementById('preset-portrait').addEventListener('click', presetPortrait);
        document.getElementById('preset-backlight').addEventListener('click', presetBacklight);
        document.getElementById('preset-reset').addEventListener('click', resetAll);

        document.getElementById('btn-clear-data').addEventListener('click', clearData);
    }

    function applyTheme() {
        document.documentElement.setAttribute('data-theme', state.theme);
    }

    function toggleTheme() {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        applyTheme();
        saveState();
        render();
        showToast('Theme changed to ' + state.theme, 'info');
    }

    /* ==================== IMAGE HANDLING ==================== */

    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.add('drag-over');
    }

    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('drag-over');
    }

    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('drag-over');
        var files = e.dataTransfer.files;
        if (files.length > 0) {
            loadImage(files[0]);
        }
    }

    function handleFileSelect(e) {
        if (e.target.files.length > 0) {
            loadImage(e.target.files[0]);
        }
    }

    function loadImage(file) {
        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file', 'error');
            return;
        }

        var reader = new FileReader();
        reader.onload = function (ev) {
            var img = new Image();
            img.onload = function () {
                originalImage = img;
                setupCanvases(img);
                drawOriginal();
                updateImageInfo(file, img);
                updateHistogram();
                updateUIState();
                resetSliders();
                showToast('Image loaded: ' + img.width + 'x' + img.height, 'success');
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    }

    function setupCanvases(img) {
        currentCanvas = document.getElementById('preview-canvas');
        currentCtx = currentCanvas.getContext('2d');

        var maxSize = 1200;
        var w = img.width;
        var h = img.height;
        if (w > maxSize || h > maxSize) {
            var ratio = Math.min(maxSize / w, maxSize / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
        }

        currentCanvas.width = w;
        currentCanvas.height = h;

        processingCanvas = document.createElement('canvas');
        processingCanvas.width = w;
        processingCanvas.height = h;
        processingCtx = processingCanvas.getContext('2d');
    }

    function drawOriginal() {
        if (!originalImage || !currentCtx) return;
        currentCtx.drawImage(originalImage, 0, 0, currentCanvas.width, currentCanvas.height);
    }

    /* ==================== IMAGE PROCESSING ==================== */

    function applyProcessing() {
        if (!originalImage) {
            showToast('Please load an image first', 'error');
            return;
        }

        showProcessingOverlay(true);

        setTimeout(function () {
            try {
                processImage(processingCanvas, processingCtx, currentCanvas.width, currentCanvas.height);
                currentCtx.drawImage(processingCanvas, 0, 0);
                updateHistogram();
                showToast('Processing complete!', 'success');
            } catch (err) {
                showToast('Processing error: ' + err.message, 'error');
            }
            showProcessingOverlay(false);
        }, 50);
    }

    function processImage(canvas, ctx, w, h) {
        ctx.drawImage(originalImage, 0, 0, w, h);

        var imageData = ctx.getImageData(0, 0, w, h);

        if (settings.brightness !== 0) {
            adjustBrightness(imageData, settings.brightness);
        }
        if (settings.contrast !== 0) {
            adjustContrast(imageData, settings.contrast);
        }
        if (settings.shadows !== 0) {
            adjustShadows(imageData, settings.shadows);
        }
        if (settings.highlights !== 0) {
            adjustHighlights(imageData, settings.highlights);
        }

        ctx.putImageData(imageData, 0, 0);

        if (settings.smoothing > 0) {
            applySkinSmoothing(canvas, ctx, w, h, settings.smoothing);
        }

        if (settings.sharpness > 0) {
            applySharpening(canvas, ctx, w, h, settings.sharpness);
        }
    }

    function adjustBrightness(imageData, value) {
        var d = imageData.data;
        var factor = value * 2.55;
        for (var i = 0; i < d.length; i += 4) {
            d[i] = clamp(d[i] + factor);
            d[i + 1] = clamp(d[i + 1] + factor);
            d[i + 2] = clamp(d[i + 2] + factor);
        }
    }

    function adjustContrast(imageData, value) {
        var d = imageData.data;
        var factor = (259 * (value + 255)) / (255 * (259 - value));
        for (var i = 0; i < d.length; i += 4) {
            d[i] = clamp(factor * (d[i] - 128) + 128);
            d[i + 1] = clamp(factor * (d[i + 1] - 128) + 128);
            d[i + 2] = clamp(factor * (d[i + 2] - 128) + 128);
        }
    }

    function adjustShadows(imageData, value) {
        var d = imageData.data;
        var amount = value / 100;
        for (var i = 0; i < d.length; i += 4) {
            for (var c = 0; c < 3; c++) {
                var v = d[i + c] / 255;
                if (v < 0.5) {
                    var lift = amount * (1 - v * 2) * 0.5;
                    d[i + c] = clamp((v + lift) * 255);
                }
            }
        }
    }

    function adjustHighlights(imageData, value) {
        var d = imageData.data;
        var amount = value / 100;
        for (var i = 0; i < d.length; i += 4) {
            for (var c = 0; c < 3; c++) {
                var v = d[i + c] / 255;
                if (v > 0.5) {
                    var compress = amount * (v * 2 - 1) * 0.5;
                    d[i + c] = clamp((v - compress) * 255);
                }
            }
        }
    }

    function applySkinSmoothing(canvas, ctx, w, h, amount) {
        var originalData = ctx.getImageData(0, 0, w, h);

        var blurCanvas = document.createElement('canvas');
        blurCanvas.width = w;
        blurCanvas.height = h;
        var blurCtx = blurCanvas.getContext('2d');

        var blurRadius = Math.max(1, Math.round(amount / 8));
        blurCtx.filter = 'blur(' + blurRadius + 'px)';
        blurCtx.drawImage(canvas, 0, 0);

        var blurredData = blurCtx.getImageData(0, 0, w, h);
        var oD = originalData.data;
        var bD = blurredData.data;
        var blendAmount = amount / 100;

        for (var i = 0; i < oD.length; i += 4) {
            var r = oD[i], g = oD[i + 1], b = oD[i + 2];
            if (isSkinTone(r, g, b)) {
                oD[i] = clamp(r + (bD[i] - r) * blendAmount);
                oD[i + 1] = clamp(g + (bD[i + 1] - g) * blendAmount);
                oD[i + 2] = clamp(b + (bD[i + 2] - b) * blendAmount);
            }
        }

        ctx.putImageData(originalData, 0, 0);
    }

    function isSkinTone(r, g, b) {
        var rn = r / 255, gn = g / 255, bn = b / 255;
        var max = Math.max(rn, gn, bn);
        var min = Math.min(rn, gn, bn);
        var l = (max + min) / 2;

        if (max === min) return false;

        var d = max - min;
        var s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        var h;
        if (max === rn) {
            h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        } else if (max === gn) {
            h = ((bn - rn) / d + 2) / 6;
        } else {
            h = ((rn - gn) / d + 4) / 6;
        }

        h *= 360;

        return h >= 0 && h <= 50 && s >= 0.12 && s <= 0.78 && l >= 0.15 && l <= 0.85;
    }

    function applySharpening(canvas, ctx, w, h, amount) {
        var originalData = ctx.getImageData(0, 0, w, h);

        var blurCanvas = document.createElement('canvas');
        blurCanvas.width = w;
        blurCanvas.height = h;
        var blurCtx = blurCanvas.getContext('2d');
        blurCtx.filter = 'blur(1px)';
        blurCtx.drawImage(canvas, 0, 0);

        var blurredData = blurCtx.getImageData(0, 0, w, h);
        var oD = originalData.data;
        var bD = blurredData.data;
        var strength = amount / 50;

        for (var i = 0; i < oD.length; i += 4) {
            oD[i] = clamp(oD[i] + (oD[i] - bD[i]) * strength);
            oD[i + 1] = clamp(oD[i + 1] + (oD[i + 1] - bD[i + 1]) * strength);
            oD[i + 2] = clamp(oD[i + 2] + (oD[i + 2] - bD[i + 2]) * strength);
        }

        ctx.putImageData(originalData, 0, 0);
    }

    function clamp(v) {
        return Math.max(0, Math.min(255, Math.round(v)));
    }

    /* ==================== HISTOGRAM ==================== */

    function updateHistogram() {
        var canvas = document.getElementById('histogram-canvas');
        if (!canvas) return;
        var ctx = canvas.getContext('2d');

        var sourceCanvas = currentCanvas;
        if (!sourceCanvas || sourceCanvas.width === 0) return;

        var sourceCtx = sourceCanvas.getContext('2d');
        var imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
        var d = imageData.data;

        var rHist = new Array(256).fill(0);
        var gHist = new Array(256).fill(0);
        var bHist = new Array(256).fill(0);

        for (var i = 0; i < d.length; i += 4) {
            rHist[d[i]]++;
            gHist[d[i + 1]]++;
            bHist[d[i + 2]]++;
        }

        var maxVal = 0;
        for (var j = 1; j < 254; j++) {
            if (rHist[j] > maxVal) maxVal = rHist[j];
            if (gHist[j] > maxVal) maxVal = gHist[j];
            if (bHist[j] > maxVal) maxVal = bHist[j];
        }

        if (maxVal === 0) maxVal = 1;

        var w = canvas.width;
        var h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        var histBg = getComputedStyle(document.documentElement).getPropertyValue('--histogram-bg').trim() || '#0d1b30';
        ctx.fillStyle = histBg;
        ctx.fillRect(0, 0, w, h);

        var barWidth = w / 256;
        var channels = [
            { data: rHist, color: 'rgba(255, 80, 80, 0.45)' },
            { data: gHist, color: 'rgba(80, 220, 80, 0.45)' },
            { data: bHist, color: 'rgba(80, 130, 255, 0.45)' }
        ];

        channels.forEach(function (ch) {
            ctx.fillStyle = ch.color;
            ctx.beginPath();
            ctx.moveTo(0, h);
            for (var k = 0; k < 256; k++) {
                var barH = (ch.data[k] / maxVal) * h;
                ctx.lineTo(k * barWidth, h - barH);
            }
            ctx.lineTo(w, h);
            ctx.closePath();
            ctx.fill();
        });
    }

    /* ==================== PRESETS ==================== */

    function presetFacebook() {
        if (!originalImage) { showToast('Please load an image first', 'error'); return; }
        setSliders({ brightness: 5, contrast: 10, shadows: 20, highlights: -10, smoothing: 40, sharpness: 60 });
        applyProcessing();
    }

    function presetPortrait() {
        if (!originalImage) { showToast('Please load an image first', 'error'); return; }
        setSliders({ brightness: 8, contrast: 5, shadows: 15, highlights: -5, smoothing: 70, sharpness: 35 });
        applyProcessing();
    }

    function presetBacklight() {
        if (!originalImage) { showToast('Please load an image first', 'error'); return; }
        setSliders({ brightness: 20, contrast: 12, shadows: 85, highlights: -60, smoothing: 0, sharpness: 30 });
        applyProcessing();
    }

    function setSliders(values) {
        Object.keys(values).forEach(function (key) {
            settings[key] = values[key];
            var slider = document.getElementById('slider-' + key);
            var display = document.getElementById('value-' + key);
            if (slider) slider.value = values[key];
            if (display) display.textContent = values[key];
        });
    }

    function resetSliders() {
        setSliders({ brightness: 0, contrast: 0, shadows: 0, highlights: 0, smoothing: 0, sharpness: 0 });
    }

    function resetAll() {
        if (!originalImage) { showToast('Please load an image first', 'error'); return; }
        resetSliders();
        drawOriginal();
        updateHistogram();
        showToast('All settings reset', 'info');
    }

    /* ==================== DOWNLOAD ==================== */

    function downloadImage() {
        if (!originalImage) {
            showToast('Please load an image first', 'error');
            return;
        }

        showProcessingOverlay(true);
        showToast('Preparing HD export...', 'info');

        setTimeout(function () {
            try {
                var exportCanvas = document.createElement('canvas');
                var w = originalImage.width;
                var h = originalImage.height;
                var maxSize = 2048;

                if (w > maxSize || h > maxSize) {
                    var ratio = Math.min(maxSize / w, maxSize / h);
                    w = Math.round(w * ratio);
                    h = Math.round(h * ratio);
                }

                exportCanvas.width = w;
                exportCanvas.height = h;
                var exportCtx = exportCanvas.getContext('2d');

                processImage(exportCanvas, exportCtx, w, h);

                exportCanvas.toBlob(function (blob) {
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = 'chum_image_' + Date.now() + '.jpg';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    var sizeKB = Math.round(blob.size / 1024);
                    showToast('Downloaded! ' + w + 'x' + h + 'px (' + sizeKB + ' KB)', 'success');
                    showProcessingOverlay(false);
                }, 'image/jpeg', 0.95);
            } catch (err) {
                showToast('Export error: ' + err.message, 'error');
                showProcessingOverlay(false);
            }
        }, 50);
    }

    /* ==================== UI HELPERS ==================== */

    function updateUIState() {
        var hasImage = !!originalImage;
        var emptyState = document.getElementById('empty-state');
        var previewArea = document.getElementById('preview-area');

        if (emptyState) emptyState.style.display = hasImage ? 'none' : 'flex';
        if (previewArea) previewArea.style.display = hasImage ? 'flex' : 'none';

        var requiresImage = document.querySelectorAll('.requires-image');
        for (var i = 0; i < requiresImage.length; i++) {
            var el = requiresImage[i];
            if (hasImage) {
                el.removeAttribute('disabled');
                el.classList.remove('disabled');
            } else {
                el.setAttribute('disabled', 'true');
                el.classList.add('disabled');
            }
        }
    }

    function updateImageInfo(file, img) {
        var info = document.getElementById('image-info');
        if (!info) return;

        var size = file.size > 1024 * 1024
            ? (file.size / (1024 * 1024)).toFixed(2) + ' MB'
            : (file.size / 1024).toFixed(1) + ' KB';

        var exportW = img.width;
        var exportH = img.height;
        var maxSize = 2048;
        if (exportW > maxSize || exportH > maxSize) {
            var ratio = Math.min(maxSize / exportW, maxSize / exportH);
            exportW = Math.round(exportW * ratio);
            exportH = Math.round(exportH * ratio);
        }

        info.innerHTML =
            '<div class="info-row"><span>Original</span><span>' + img.width + ' x ' + img.height + '</span></div>' +
            '<div class="info-row"><span>Export Size</span><span>' + exportW + ' x ' + exportH + '</span></div>' +
            '<div class="info-row"><span>File Size</span><span>' + size + '</span></div>' +
            '<div class="info-row"><span>Format</span><span>' + file.type.split('/')[1].toUpperCase() + '</span></div>';
    }

    function showProcessingOverlay(show) {
        var overlay = document.getElementById('processing-overlay');
        if (overlay) overlay.style.display = show ? 'flex' : 'none';
    }

    /* ==================== TOAST ==================== */

    function showToast(message, type) {
        var container = document.getElementById('toast-container');
        if (!container) return;

        var toast = document.createElement('div');
        toast.className = 'toast toast-' + (type || 'info');

        var icons = { success: '\u2705', error: '\u274C', info: '\u2139\uFE0F', warning: '\u26A0\uFE0F' };
        toast.textContent = (icons[type] || '\u2139\uFE0F') + ' ' + message;

        container.appendChild(toast);

        requestAnimationFrame(function () {
            toast.classList.add('show');
        });

        setTimeout(function () {
            toast.classList.remove('show');
            setTimeout(function () { toast.remove(); }, 300);
        }, 3000);
    }

    /* ==================== SYSTEM ==================== */

    function clearData() {
        if (!confirm('Clear all app data and reset?')) return;

        localStorage.removeItem(STORAGE_KEY);
        originalImage = null;

        if (currentCanvas && currentCtx) {
            currentCtx.clearRect(0, 0, currentCanvas.width, currentCanvas.height);
            currentCanvas.width = 0;
            currentCanvas.height = 0;
        }

        resetSliders();
        state = {
            version: APP_VERSION,
            app: APP_NAME,
            theme: document.documentElement.getAttribute('data-theme') || 'dark',
            data: [],
            meta: {
                created_at: new Date().toISOString(),
                updated_at: ''
            }
        };
        saveState();
        render();

        var info = document.getElementById('image-info');
        if (info) info.innerHTML = '<p class="empty-hint">Load an image to see details</p>';

        var histCanvas = document.getElementById('histogram-canvas');
        if (histCanvas) {
            var hCtx = histCanvas.getContext('2d');
            hCtx.clearRect(0, 0, histCanvas.width, histCanvas.height);
        }

        showToast('All data cleared', 'info');
    }

    /* ==================== SERVICE WORKER ==================== */

    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then(function (reg) { console.log('SW registered:', reg.scope); })
                .catch(function (err) { console.warn('SW registration failed:', err); });
        }
    }

    /* ==================== THEME PRE-RENDER ==================== */

    (function () {
        try {
            var saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                var parsed = JSON.parse(saved);
                if (parsed.theme) {
                    document.documentElement.setAttribute('data-theme', parsed.theme);
                }
            }
        } catch (e) { /* ignore */ }
    })();

    /* ==================== STARTUP ==================== */

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
