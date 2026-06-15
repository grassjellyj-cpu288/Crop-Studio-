(function() {
    // ----- DOM -----
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const toolbarContainer = document.getElementById('toolbarContainer');
    const statusHint = document.getElementById('statusHint');

    // ----- 图片数据 -----
    let originalImage = new Image();      // 当前显示的图像（可能已被裁剪）
    let baseOriginalImage = null;         // 最初加载的原始图像副本（用于重置）
    let imageLoaded = false;
    let imgWidth = 0, imgHeight = 0;
    
    // 绘制区域
    let drawRect = { x: 0, y: 0, w: 0, h: 0 };
    
    // 裁剪状态
    let cropModeActive = false;
    let cropRect = { x: 0, y: 0, w: 0, h: 0 };
    let hasCropSelection = false;
    
    // 交互变量
    let activeHandle = null;
    let dragStart = { x: 0, y: 0 };
    let startCropRect = { x: 0, y: 0, w: 0, h: 0 };
    let isDragging = false;
    
    // 比例锁定
    let currentRatio = null;
    
    const HANDLE_SIZE = 12;
    const MIN_CROP_SIZE = 16;
    
    // 动态按钮
    let cropBtn, applyBtn, cancelBtn, saveBtn, resetBtn, fileInput, infoPanel;
    let ratioBtns = [];
    
    // ---------- 辅助函数 ----------
    function resizeCanvasToWindow() {
        const toolbarHeight = document.querySelector('.toolbar')?.offsetHeight || 70;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - toolbarHeight;
        render();
    }
    
    function updateDrawRect() {
        if (!imageLoaded) return;
        const canvasW = canvas.width;
        const canvasH = canvas.height;
        const imgAspect = imgWidth / imgHeight;
        const canvasAspect = canvasW / canvasH;
        
        let drawW, drawH, drawX, drawY;
        if (imgAspect > canvasAspect) {
            drawW = canvasW;
            drawH = canvasW / imgAspect;
            drawX = 0;
            drawY = (canvasH - drawH) / 2;
        } else {
            drawH = canvasH;
            drawW = canvasH * imgAspect;
            drawX = (canvasW - drawW) / 2;
            drawY = 0;
        }
        drawRect = { x: drawX, y: drawY, w: drawW, h: drawH };
    }
    
    function clampCropRect(rect) {
        let newRect = { ...rect };
        if (newRect.w < MIN_CROP_SIZE) newRect.w = MIN_CROP_SIZE;
        if (newRect.h < MIN_CROP_SIZE) newRect.h = MIN_CROP_SIZE;
        const maxX = drawRect.x + drawRect.w - newRect.w;
        const maxY = drawRect.y + drawRect.h - newRect.h;
        newRect.x = Math.min(Math.max(newRect.x, drawRect.x), maxX);
        newRect.y = Math.min(Math.max(newRect.y, drawRect.y), maxY);
        if (newRect.x + newRect.w > drawRect.x + drawRect.w) newRect.w = drawRect.w;
        if (newRect.y + newRect.h > drawRect.y + drawRect.h) newRect.h = drawRect.h;
        return newRect;
    }
    
    function applyRatioConstraint(rect, originHandle, startRect) {
        if (currentRatio === null) return rect;
        let newRect = { ...rect };
        const ratio = currentRatio;
        if (originHandle === 'nw' || originHandle === 'se' || originHandle === 'sw' || originHandle === 'ne') {
            let deltaW = newRect.w;
            let deltaH = newRect.h;
            const targetH = deltaW / ratio;
            if (targetH >= MIN_CROP_SIZE) {
                newRect.h = targetH;
            } else {
                newRect.w = deltaH * ratio;
                newRect.h = deltaH;
            }
            if (originHandle === 'nw') {
                newRect.y = startRect.y + startRect.h - newRect.h;
                newRect.x = startRect.x + startRect.w - newRect.w;
            } else if (originHandle === 'ne') {
                newRect.y = startRect.y + startRect.h - newRect.h;
            } else if (originHandle === 'sw') {
                newRect.x = startRect.x + startRect.w - newRect.w;
            }
        } 
        else if (originHandle === 'n' || originHandle === 's') {
            newRect.w = newRect.h * ratio;
        } 
        else if (originHandle === 'w' || originHandle === 'e') {
            newRect.h = newRect.w / ratio;
        }
        return newRect;
    }
    
    function initDefaultCropRect() {
        if (!imageLoaded) return;
        const defaultW = Math.max(120, drawRect.w * 0.7);
        const defaultH = Math.max(120, drawRect.h * 0.7);
        let x = drawRect.x + (drawRect.w - defaultW) / 2;
        let y = drawRect.y + (drawRect.h - defaultH) / 2;
        cropRect = { x, y, w: defaultW, h: defaultH };
        cropRect = clampCropRect(cropRect);
        hasCropSelection = true;
    }
    
    function canvasToOriginalCoords(canvasX, canvasY) {
        const fx = (canvasX - drawRect.x) / drawRect.w;
        const fy = (canvasY - drawRect.y) / drawRect.h;
        return { x: fx * imgWidth, y: fy * imgHeight };
    }
    
    async function performCropAndReplace() {
        return new Promise((resolve) => {
            if (!imageLoaded || !hasCropSelection) return resolve(false);
            const leftTop = canvasToOriginalCoords(cropRect.x, cropRect.y);
            const rightBottom = canvasToOriginalCoords(cropRect.x + cropRect.w, cropRect.y + cropRect.h);
            const sx = Math.max(0, leftTop.x);
            const sy = Math.max(0, leftTop.y);
            const sw = Math.min(imgWidth - sx, rightBottom.x - leftTop.x);
            const sh = Math.min(imgHeight - sy, rightBottom.y - leftTop.y);
            if (sw < 2 || sh < 2) return resolve(false);
            
            const croppedCanvas = document.createElement('canvas');
            croppedCanvas.width = sw;
            croppedCanvas.height = sh;
            const cropCtx = croppedCanvas.getContext('2d');
            cropCtx.drawImage(originalImage, sx, sy, sw, sh, 0, 0, sw, sh);
            
            const newImg = new Image();
            newImg.src = croppedCanvas.toDataURL('image/png');
            newImg.onload = () => {
                originalImage = newImg;
                imgWidth = originalImage.width;
                imgHeight = originalImage.height;
                updateDrawRect();
                imageLoaded = true;
                cropModeActive = false;
                if (cropBtn) cropBtn.classList.remove('active');
                hasCropSelection = false;
                updateInfoPanel();
                render();
                statusHint.innerText = '✅ Crop applied! New image loaded.';
                setTimeout(() => {
                    if (!cropModeActive) statusHint.innerText = '✨ Crop mode off. Click Crop to edit.';
                }, 2000);
                resolve(true);
            };
            newImg.onerror = () => resolve(false);
        });
    }
    
    // 重置到原始图像
    function resetToOriginal() {
        if (!baseOriginalImage) {
            statusHint.innerText = '⚠️ No original image to reset to.';
            return;
        }
        // 复制原始图像（避免引用）
        const resetImg = new Image();
        resetImg.onload = () => {
            originalImage = resetImg;
            imgWidth = originalImage.width;
            imgHeight = originalImage.height;
            imageLoaded = true;
            cropModeActive = false;
            if (cropBtn) cropBtn.classList.remove('active');
            hasCropSelection = false;
            updateDrawRect();
            updateInfoPanel();
            render();
            statusHint.innerText = '🔄 Reset to original image.';
        };
        resetImg.src = baseOriginalImage.src; // baseOriginalImage 是 Image 对象，保留其 src
    }
    
    // ---------- 绘图 ----------
    function drawOverlayAndCrop() {
        if (!imageLoaded) return;
        ctx.save();
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = '#010101';
        ctx.fillRect(0, 0, canvas.width, cropRect.y);
        ctx.fillRect(0, cropRect.y + cropRect.h, canvas.width, canvas.height - (cropRect.y + cropRect.h));
        ctx.fillRect(0, cropRect.y, cropRect.x, cropRect.h);
        ctx.fillRect(cropRect.x + cropRect.w, cropRect.y, canvas.width - (cropRect.x + cropRect.w), cropRect.h);
        ctx.restore();
        
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([10, 6]);
        ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
        ctx.setLineDash([]);
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 2;
        ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
        
        const positions = [
            { cx: cropRect.x, cy: cropRect.y, type: 'nw' },
            { cx: cropRect.x + cropRect.w/2, cy: cropRect.y, type: 'n' },
            { cx: cropRect.x + cropRect.w, cy: cropRect.y, type: 'ne' },
            { cx: cropRect.x + cropRect.w, cy: cropRect.y + cropRect.h/2, type: 'e' },
            { cx: cropRect.x + cropRect.w, cy: cropRect.y + cropRect.h, type: 'se' },
            { cx: cropRect.x + cropRect.w/2, cy: cropRect.y + cropRect.h, type: 's' },
            { cx: cropRect.x, cy: cropRect.y + cropRect.h, type: 'sw' },
            { cx: cropRect.x, cy: cropRect.y + cropRect.h/2, type: 'w' }
        ];
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 4;
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        for (let p of positions) {
            ctx.beginPath();
            ctx.arc(p.cx, p.cy, HANDLE_SIZE/1.6, 0, 2*Math.PI);
            ctx.fillStyle = '#1e1e2a';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(p.cx, p.cy, HANDLE_SIZE/2.8, 0, 2*Math.PI);
            ctx.fillStyle = '#b9c3ff';
            ctx.fill();
        }
        ctx.restore();
        
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#ddddff';
        ctx.lineWidth = 0.8;
        const thirdX1 = cropRect.x + cropRect.w/3;
        const thirdX2 = cropRect.x + 2*cropRect.w/3;
        const thirdY1 = cropRect.y + cropRect.h/3;
        const thirdY2 = cropRect.y + 2*cropRect.h/3;
        ctx.beginPath(); ctx.moveTo(thirdX1, cropRect.y); ctx.lineTo(thirdX1, cropRect.y+cropRect.h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(thirdX2, cropRect.y); ctx.lineTo(thirdX2, cropRect.y+cropRect.h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cropRect.x, thirdY1); ctx.lineTo(cropRect.x+cropRect.w, thirdY1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cropRect.x, thirdY2); ctx.lineTo(cropRect.x+cropRect.w, thirdY2); ctx.stroke();
        ctx.restore();
    }
    
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (imageLoaded) {
            ctx.drawImage(originalImage, drawRect.x, drawRect.y, drawRect.w, drawRect.h);
        } else {
            ctx.fillStyle = '#22222a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#aaa';
            ctx.font = '14px monospace';
            ctx.fillText('📁 Load an image to start', canvas.width/2-100, canvas.height/2);
            return;
        }
        if (cropModeActive && hasCropSelection) {
            drawOverlayAndCrop();
        } else if (cropModeActive && !hasCropSelection && imageLoaded) {
            initDefaultCropRect();
            render();
        }
    }
    
    function updateInfoPanel() {
        if (!infoPanel) return;
        if (!imageLoaded) infoPanel.innerHTML = `📷 No image`;
        else infoPanel.innerHTML = `🖼️ ${imgWidth}×${imgHeight}  |  crop mode ${cropModeActive ? 'ON' : 'OFF'}`;
    }
    
    // ---------- 交互 ----------
    function getHandleUnderPoint(px, py) {
        if (!hasCropSelection) return null;
        const handles = [
            { x: cropRect.x, y: cropRect.y, type: 'nw' },
            { x: cropRect.x + cropRect.w/2, y: cropRect.y, type: 'n' },
            { x: cropRect.x + cropRect.w, y: cropRect.y, type: 'ne' },
            { x: cropRect.x + cropRect.w, y: cropRect.y + cropRect.h/2, type: 'e' },
            { x: cropRect.x + cropRect.w, y: cropRect.y + cropRect.h, type: 'se' },
            { x: cropRect.x + cropRect.w/2, y: cropRect.y + cropRect.h, type: 's' },
            { x: cropRect.x, y: cropRect.y + cropRect.h, type: 'sw' },
            { x: cropRect.x, y: cropRect.y + cropRect.h/2, type: 'w' }
        ];
        const radius = HANDLE_SIZE;
        for (let h of handles) {
            const dx = px - h.x;
            const dy = py - h.y;
            if (Math.hypot(dx, dy) <= radius) return h.type;
        }
        if (px >= cropRect.x && px <= cropRect.x + cropRect.w && py >= cropRect.y && py <= cropRect.y + cropRect.h) return 'move';
        return null;
    }
    
    function resizeCrop(handle, deltaX, deltaY, startRect) {
        let newRect = { ...startRect };
        switch(handle) {
            case 'nw': newRect.x = startRect.x + deltaX; newRect.w = startRect.w - deltaX; newRect.y = startRect.y + deltaY; newRect.h = startRect.h - deltaY; break;
            case 'n':  newRect.y = startRect.y + deltaY; newRect.h = startRect.h - deltaY; break;
            case 'ne': newRect.w = startRect.w + deltaX; newRect.y = startRect.y + deltaY; newRect.h = startRect.h - deltaY; break;
            case 'e':  newRect.w = startRect.w + deltaX; break;
            case 'se': newRect.w = startRect.w + deltaX; newRect.h = startRect.h + deltaY; break;
            case 's':  newRect.h = startRect.h + deltaY; break;
            case 'sw': newRect.x = startRect.x + deltaX; newRect.w = startRect.w - deltaX; newRect.h = startRect.h + deltaY; break;
            case 'w':  newRect.x = startRect.x + deltaX; newRect.w = startRect.w - deltaX; break;
            default: return newRect;
        }
        if (newRect.w < MIN_CROP_SIZE) {
            if (handle.includes('w') || handle === 'nw' || handle === 'sw') newRect.x = startRect.x + startRect.w - MIN_CROP_SIZE;
            newRect.w = MIN_CROP_SIZE;
        }
        if (newRect.h < MIN_CROP_SIZE) {
            if (handle.includes('n')) newRect.y = startRect.y + startRect.h - MIN_CROP_SIZE;
            newRect.h = MIN_CROP_SIZE;
        }
        newRect = clampCropRect(newRect);
        if (currentRatio !== null) {
            newRect = applyRatioConstraint(newRect, handle, startRect);
            newRect = clampCropRect(newRect);
        }
        return newRect;
    }
    
    function getCanvasCoords(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        let clientX, clientY;
        if (e.touches) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        let canvasX = (clientX - rect.left) * scaleX;
        let canvasY = (clientY - rect.top) * scaleY;
        canvasX = Math.min(Math.max(0, canvasX), canvas.width);
        canvasY = Math.min(Math.max(0, canvasY), canvas.height);
        return { x: canvasX, y: canvasY };
    }
    
    function onPointerDown(e) {
        e.preventDefault();
        if (!imageLoaded) return;
        const coords = getCanvasCoords(e);
        if (cropModeActive) {
            const handle = getHandleUnderPoint(coords.x, coords.y);
            if (handle) {
                activeHandle = handle;
                isDragging = true;
                dragStart = { x: coords.x, y: coords.y };
                startCropRect = { ...cropRect };
                canvas.setPointerCapture(e.pointerId);
            } else {
                activeHandle = 'new';
                isDragging = true;
                dragStart = { x: coords.x, y: coords.y };
                startCropRect = null;
            }
        }
    }
    
    function onPointerMove(e) {
        if (!isDragging || !cropModeActive || !imageLoaded) return;
        e.preventDefault();
        const coords = getCanvasCoords(e);
        const deltaX = coords.x - dragStart.x;
        const deltaY = coords.y - dragStart.y;
        
        if (activeHandle === 'new') {
            let x = Math.min(dragStart.x, coords.x);
            let y = Math.min(dragStart.y, coords.y);
            let w = Math.abs(coords.x - dragStart.x);
            let h = Math.abs(coords.y - dragStart.y);
            if (w < 4) w = MIN_CROP_SIZE;
            if (h < 4) h = MIN_CROP_SIZE;
            cropRect = { x, y, w, h };
            cropRect = clampCropRect(cropRect);
            hasCropSelection = true;
            render();
            return;
        }
        if (activeHandle === 'move') {
            let newRect = { ...cropRect, x: startCropRect.x + deltaX, y: startCropRect.y + deltaY };
            newRect = clampCropRect(newRect);
            cropRect = newRect;
            render();
            return;
        }
        if (activeHandle && activeHandle !== 'new' && startCropRect) {
            const newRect = resizeCrop(activeHandle, deltaX, deltaY, startCropRect);
            cropRect = newRect;
            hasCropSelection = true;
            render();
        }
    }
    
    function onPointerUp(e) {
        if (isDragging && activeHandle === 'new' && (!hasCropSelection || cropRect.w < MIN_CROP_SIZE || cropRect.h < MIN_CROP_SIZE)) {
            if (cropRect.w < 10 || cropRect.h < 10) initDefaultCropRect();
        }
        isDragging = false;
        activeHandle = null;
        canvas.releasePointerCapture?.(e.pointerId);
    }
    
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    
    // ---------- 动态生成工具栏（新增 Reset 按钮）----------
    function buildToolbar() {
        toolbarContainer.innerHTML = `
            <div class="toolbar-buttons">
                <input type="file" id="fileInput" accept="image/jpeg,image/png,image/webp">
                <button id="cropBtn" class="crop-mode-toggle">✂️ Crop mode</button>
                <button id="applyBtn">✅ Apply Crop</button>
                <button id="cancelBtn">❌ Cancel</button>
                <button id="saveBtn">💾 Save Image</button>
                <button id="resetBtn">🔄 Reset to Original</button>
                <div class="ratio-group">
                    <span>🔘 Ratio</span>
                    <button data-ratio="free" class="ratio-btn active-ratio">Free</button>
                    <button data-ratio="1:1" class="ratio-btn">1:1</button>
                    <button data-ratio="4:3" class="ratio-btn">4:3</button>
                    <button data-ratio="16:9" class="ratio-btn">16:9</button>
                </div>
                <div class="info-panel" id="infoPanel">📷 No image</div>
            </div>
        `;
        
        fileInput = document.getElementById('fileInput');
        cropBtn = document.getElementById('cropBtn');
        applyBtn = document.getElementById('applyBtn');
        cancelBtn = document.getElementById('cancelBtn');
        saveBtn = document.getElementById('saveBtn');
        resetBtn = document.getElementById('resetBtn');
        infoPanel = document.getElementById('infoPanel');
        ratioBtns = document.querySelectorAll('.ratio-btn');
        
        fileInput.addEventListener('change', onFileSelected);
        cropBtn.addEventListener('click', toggleCropMode);
        applyBtn.addEventListener('click', onApplyCrop);
        cancelBtn.addEventListener('click', onCancelCrop);
        saveBtn.addEventListener('click', onSaveImage);
        resetBtn.addEventListener('click', resetToOriginal);
        ratioBtns.forEach(btn => btn.addEventListener('click', onRatioChange));
        
        updateInfoPanel();
    }
    
    // ----- 事件处理函数 -----
    function onFileSelected(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const newImg = new Image();
            newImg.onload = () => {
                // 保存原始图像副本
                baseOriginalImage = new Image();
                baseOriginalImage.src = newImg.src;
                baseOriginalImage.onload = () => {
                    // 确保副本加载完成
                };
                originalImage = newImg;
                imgWidth = originalImage.width;
                imgHeight = originalImage.height;
                imageLoaded = true;
                cropModeActive = false;
                if (cropBtn) cropBtn.classList.remove('active');
                hasCropSelection = false;
                updateDrawRect();
                updateInfoPanel();
                render();
                statusHint.innerText = '📸 Image loaded! Click Crop mode.';
            };
            newImg.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    function toggleCropMode() {
        if (!imageLoaded) {
            statusHint.innerText = '⚠️ Load an image first!';
            return;
        }
        cropModeActive = !cropModeActive;
        if (cropModeActive) {
            cropBtn.classList.add('active');
            statusHint.innerText = '✂️ Crop mode ON — drag to select, move/resize handles';
            if (!hasCropSelection) initDefaultCropRect();
            else render();
        } else {
            cropBtn.classList.remove('active');
            statusHint.innerText = '✨ Crop mode OFF. Click "Crop mode" to edit.';
            hasCropSelection = false;
        }
        render();
        updateInfoPanel();
    }
    
    async function onApplyCrop() {
        if (!imageLoaded || !cropModeActive || !hasCropSelection) {
            statusHint.innerText = '⚠️ Activate crop mode and select region first.';
            return;
        }
        await performCropAndReplace();
        updateInfoPanel();
        render();
    }
    
    function onCancelCrop() {
        if (cropModeActive) {
            cropModeActive = false;
            cropBtn.classList.remove('active');
            hasCropSelection = false;
            render();
            statusHint.innerText = 'Crop cancelled.';
            updateInfoPanel();
        } else {
            statusHint.innerText = 'Not in crop mode.';
        }
    }
    
    function onSaveImage() {
        if (!imageLoaded) return;
        const link = document.createElement('a');
        link.download = 'cropped_masterpiece.png';
        const canvasTemp = document.createElement('canvas');
        canvasTemp.width = imgWidth;
        canvasTemp.height = imgHeight;
        const tempCtx = canvasTemp.getContext('2d');
        tempCtx.drawImage(originalImage, 0, 0);
        link.href = canvasTemp.toDataURL('image/png');
        link.click();
        statusHint.innerText = '💾 Image saved!';
    }
    
    function onRatioChange(e) {
        ratioBtns.forEach(btn => btn.classList.remove('active-ratio'));
        e.currentTarget.classList.add('active-ratio');
        const ratioVal = e.currentTarget.getAttribute('data-ratio');
        if (ratioVal === 'free') currentRatio = null;
        else if (ratioVal === '1:1') currentRatio = 1;
        else if (ratioVal === '4:3') currentRatio = 4/3;
        else if (ratioVal === '16:9') currentRatio = 16/9;
        
        if (cropModeActive && hasCropSelection) {
            const centerX = cropRect.x + cropRect.w/2;
            const centerY = cropRect.y + cropRect.h/2;
            let newW = cropRect.w, newH = cropRect.h;
            if (currentRatio) {
                newH = newW / currentRatio;
                if (newH > drawRect.h) { newH = drawRect.h; newW = newH * currentRatio; }
                if (newW > drawRect.w) { newW = drawRect.w; newH = newW / currentRatio; }
                cropRect = { x: centerX - newW/2, y: centerY - newH/2, w: newW, h: newH };
                cropRect = clampCropRect(cropRect);
                render();
            }
        }
    }
    
    // 窗口大小调整
    window.addEventListener('resize', () => {
        resizeCanvasToWindow();
        if (imageLoaded) {
            updateDrawRect();
            if (cropModeActive && hasCropSelection) cropRect = clampCropRect(cropRect);
            render();
        } else render();
    });
    
    // 启动
    buildToolbar();
    resizeCanvasToWindow();
})();