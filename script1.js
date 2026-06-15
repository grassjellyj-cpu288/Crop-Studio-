// script1.js - Voice command module + Keyboard shortcuts + Anti-DevTools
// ป้องกัน: F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, คลิกขวา

(function() {
    'use strict';

    // ========================== CONFIGURATION ==========================
    const CONFIG = {
        defaultLang: 'th',
        supportedLangs: ['th', 'en'],
        recognition: {
            continuous: false,
            interimResults: false,
            maxAlternatives: 1
        },
        synthesis: {
            rate: 0.9,
            pitch: 1.0,
            volume: 1.0
        },
        micButton: {
            id: 'voiceMicBtn',
            text: { th: '🎤 สั่งงานด้วยเสียง', en: '🎤 Voice Command' },
            listeningClass: 'listening',
            style: {
                background: '#4f46e5',
                borderColor: '#a5b4fc',
                marginLeft: '8px'
            }
        },
        hotword: { th: 'เฮ้ครอป', en: 'hey crop' },
        hotwordEnabled: false,
        confirmCritical: true,
        showVisualizer: true,
        debug: true,
        keyboardShortcuts: true,
        // ✅ เพิ่มตัวเลือกป้องกัน DevTools
        enableDevToolsProtection: true
    };

    // ========================== DOM ELEMENTS ==========================
    let fileInput = null,
        cropBtn = null,
        applyBtn = null,
        cancelBtn = null,
        saveBtn = null,
        resetBtn = null,
        statusHint = null,
        micButton = null,
        visualizerElement = null;

    let ratioBtns = [];

    // ========================== SPEECH RECOGNITION ==========================
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let listening = false;
    let currentLang = CONFIG.defaultLang;
    let isHotwordActive = false;

    // ========================== SPEECH SYNTHESIS ==========================
    const synth = window.speechSynthesis;
    let synthesisQueue = [];
    let isSpeaking = false;

    // ========================== COMMAND DATABASE ==========================
    const commands = [
        { langs: { th: ['โหลดรูป', 'เลือกรูป', 'อัปโหลดรูป'], en: ['load image', 'select image', 'upload'] },
          action: () => triggerFileInput(), critical: false },
        { langs: { th: ['โหมดครอบ', 'ครอปรูป', 'เริ่มครอบ'], en: ['crop mode', 'start crop', 'enter crop'] },
          action: () => clickButton(cropBtn, 'Crop mode'), critical: false },
        { langs: { th: ['ตกลง', 'ใช้การครอบ', 'ยืนยัน'], en: ['apply', 'confirm crop', 'ok'] },
          action: () => clickButton(applyBtn, 'Apply Crop'), critical: false },
        { langs: { th: ['ยกเลิก', 'ยกเลิกการครอบ'], en: ['cancel', 'abort crop'] },
          action: () => clickButton(cancelBtn, 'Cancel'), critical: false },
        { langs: { th: ['บันทึก', 'เซฟรูป', 'บันทึกรูป'], en: ['save', 'save image', 'download'] },
          action: () => handleCriticalAction(saveBtn, 'Save Image', 'คุณต้องการบันทึกรูปภาพใช่ไหม?', 'Do you want to save the image?'), critical: true },
        { langs: { th: ['รีเซ็ต', 'คืนค่าเดิม', 'reset'], en: ['reset', 'original', 'revert'] },
          action: () => handleCriticalAction(resetBtn, 'Reset', 'คุณต้องการรีเซ็ตกลับรูปเดิม?', 'Do you want to reset to original?'), critical: true },
        { langs: { th: ['อัตราส่วนอิสระ', 'ฟรี'], en: ['free ratio', 'custom ratio'] },
          action: () => selectRatio('free'), critical: false },
        { langs: { th: ['อัตราส่วนหนึ่งต่อหนึ่ง', 'หนึ่งต่อหนึ่ง', '1:1'], en: ['one to one', 'square', '1:1'] },
          action: () => selectRatio('1:1'), critical: false },
        { langs: { th: ['อัตราส่วนสี่ต่อสาม', 'สี่ต่อสาม', '4:3'], en: ['four three', '4:3'] },
          action: () => selectRatio('4:3'), critical: false },
        { langs: { th: ['อัตราส่วนสิบหกต่อเก้า', 'สิบหกต่อเก้า', '16:9'], en: ['sixteen nine', 'wide', '16:9'] },
          action: () => selectRatio('16:9'), critical: false },
        { langs: { th: ['เปลี่ยนภาษาไทย', 'ภาษาไทย'], en: ['thai language', 'set thai'] },
          action: () => setLanguage('th'), critical: false },
        { langs: { th: ['เปลี่ยนภาษาอังกฤษ', 'ภาษาอังกฤษ'], en: ['english language', 'set english'] },
          action: () => setLanguage('en'), critical: false },
        { langs: { th: ['ช่วยเหลือ', 'คำสั่ง', 'สั่งอะไรได้บ้าง'], en: ['help', 'commands', 'what can i say'] },
          action: () => showHelp(), critical: false },
        { langs: { th: ['หยุดฟัง', 'ปิดไมค์'], en: ['stop listening', 'turn off mic'] },
          action: () => stopListeningAndReset(), critical: false }
    ];

    // ========================== HELPER FUNCTIONS ==========================
    function log(...args) {
        if (CONFIG.debug) console.log('[VoiceModule]', ...args);
    }

    function updateStatus(message, isError = false) {
        if (statusHint) {
            statusHint.innerText = message;
            if (isError) {
                setTimeout(() => {
                    if (statusHint.innerText === message)
                        statusHint.innerText = getLocalizedText('readyPrompt');
                }, 4000);
            }
        }
        log(message);
    }

    function getLocalizedText(key) {
        const texts = {
            readyPrompt: { th: '🎤 คลิกไมค์แล้วพูดคำสั่ง (กด 1 โหลด, 2 ครอบ, 3 บันทึก)', en: '🎤 Click mic and speak (1 Load, 2 Crop, 3 Save)' },
            listening: { th: '🎤 กำลังฟัง... พูดได้เลย', en: '🎤 Listening... speak now' },
            stopped: { th: '🎙️ หยุดฟังแล้ว คลิกไมค์เพื่อสั่งงาน', en: '🎙️ Stopped. Click mic to start' },
            noMic: { th: '❌ เบราว์เซอร์ไม่รองรับการสั่งงานด้วยเสียง', en: '❌ Browser does not support voice commands' },
            permissionDenied: { th: 'ไม่อนุญาตให้ใช้ไมโครโฟน กรุณาอนุญาต', en: 'Microphone permission denied. Please allow.' },
            noSpeech: { th: 'ไม่พบเสียงพูด', en: 'No speech detected' },
            error: { th: 'เกิดข้อผิดพลาด', en: 'Error occurred' },
            unknownCommand: { th: 'ไม่เข้าใจคำสั่ง พูด "ช่วยเหลือ" เพื่อดูคำสั่ง', en: 'Unknown command. Say "help" for commands.' }
        };
        return texts[key]?.[currentLang] || texts[key]?.th || '';
    }

    function speak(text, lang = currentLang) {
        if (!synth) return;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = (lang === 'th') ? 'th-TH' : 'en-US';
        utterance.rate = CONFIG.synthesis.rate;
        utterance.pitch = CONFIG.synthesis.pitch;
        utterance.volume = CONFIG.synthesis.volume;
        synthesisQueue.push(utterance);
        if (!isSpeaking) processSynthesisQueue();
    }

    function processSynthesisQueue() {
        if (synthesisQueue.length === 0) {
            isSpeaking = false;
            return;
        }
        isSpeaking = true;
        const utterance = synthesisQueue.shift();
        utterance.onend = () => processSynthesisQueue();
        utterance.onerror = () => processSynthesisQueue();
        synth.speak(utterance);
    }

    function createVisualizer() {
        if (!CONFIG.showVisualizer) return null;
        const viz = document.createElement('div');
        viz.id = 'voiceVisualizer';
        viz.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 2px;
            margin-left: 8px;
            height: 24px;
        `;
        for (let i = 0; i < 5; i++) {
            const bar = document.createElement('div');
            bar.style.cssText = `width: 4px; height: 8px; background-color: #4f46e5; transition: height 0.1s ease; border-radius: 2px;`;
            viz.appendChild(bar);
        }
        return viz;
    }

    function updateVisualizer(level = 0) {
        if (!visualizerElement) return;
        const bars = visualizerElement.children;
        const height = Math.min(20, 8 + (level * 15));
        for (let i = 0; i < bars.length; i++) {
            bars[i].style.height = `${(i < level) ? height : 4}px`;
        }
    }

    function resetVisualizer() {
        if (!visualizerElement) return;
        for (let i = 0; i < visualizerElement.children.length; i++) {
            visualizerElement.children[i].style.height = '4px';
        }
    }

    // ========================== COMMAND PROCESSING ==========================
    function parseCommand(transcript) {
        const lowerText = transcript.toLowerCase().trim();
        log('Processing:', lowerText);
        if (CONFIG.hotwordEnabled && CONFIG.hotword[currentLang]) {
            const hotword = CONFIG.hotword[currentLang].toLowerCase();
            if (lowerText.startsWith(hotword)) {
                let commandText = lowerText.slice(hotword.length).trim();
                if (commandText.length === 0) {
                    speak(getLocalizedText('listening'));
                    return;
                }
                return findAndExecuteCommand(commandText);
            } else if (isHotwordActive) {
                return findAndExecuteCommand(lowerText);
            } else {
                speak(getLocalizedText('unknownCommand'));
                return;
            }
        } else {
            return findAndExecuteCommand(lowerText);
        }
    }

    function findAndExecuteCommand(text) {
        for (let cmd of commands) {
            const keywords = cmd.langs[currentLang] || cmd.langs[CONFIG.defaultLang];
            for (let kw of keywords) {
                if (text.includes(kw.toLowerCase())) {
                    log('Matched command:', kw);
                    cmd.action();
                    return true;
                }
            }
        }
        speak(getLocalizedText('unknownCommand'));
        updateStatus(`❓ ${getLocalizedText('unknownCommand')}`, true);
        return false;
    }

    async function handleCriticalAction(btn, actionName, confirmMsgTh, confirmMsgEn) {
        if (!btn) {
            speak(`ไม่พบปุ่ม ${actionName}`);
            updateStatus(`❌ ไม่พบปุ่ม ${actionName}`, true);
            return;
        }
        if (CONFIG.confirmCritical) {
            const msg = (currentLang === 'th') ? confirmMsgTh : confirmMsgEn;
            speak(msg);
            const userConfirmed = confirm(msg);
            if (userConfirmed) {
                btn.click();
                speak(`ดำเนินการ ${actionName} แล้ว`);
                updateStatus(`✅ ${actionName} ถูกเรียกใช้ผ่านเสียง`);
            } else {
                speak('ยกเลิกคำสั่ง');
                updateStatus('ยกเลิกคำสั่ง');
            }
        } else {
            btn.click();
            speak(`ดำเนินการ ${actionName} แล้ว`);
            updateStatus(`✅ ${actionName} ถูกเรียกใช้ผ่านเสียง`);
        }
    }

    function triggerFileInput() {
        refreshElements();
        if (fileInput) {
            fileInput.click();
            speak(getLocalizedText('readyPrompt'));
            updateStatus('📁 กำลังเปิดให้เลือกรูปภาพ...');
        } else {
            speak('ไม่พบปุ่มเลือกรูป');
        }
    }

    function clickButton(btn, actionName) {
        refreshElements();
        const freshBtn = btn ? document.getElementById(btn.id) : null;
        if (!freshBtn || freshBtn.disabled) {
            speak(`ไม่สามารถใช้ปุ่ม ${actionName} ในตอนนี้`);
            updateStatus(`❌ ปุ่ม ${actionName} ไม่พร้อมใช้งาน`, true);
            return;
        }
        freshBtn.click();
        speak(`ดำเนินการ ${actionName} แล้ว`);
        updateStatus(`✅ ${actionName} ถูกเรียกใช้ผ่านเสียง`);
    }

    function selectRatio(ratioValue) {
        refreshElements();
        const targetBtn = Array.from(ratioBtns).find(btn => btn.getAttribute('data-ratio') === ratioValue);
        if (targetBtn && !targetBtn.disabled) {
            targetBtn.click();
            const btnText = targetBtn.innerText.trim();
            speak(`เปลี่ยนอัตราส่วนเป็น ${btnText}`);
            updateStatus(`📐 ${btnText}`);
        } else {
            speak('ไม่พบปุ่มอัตราส่วนดังกล่าว');
        }
    }

    function setLanguage(lang) {
        if (CONFIG.supportedLangs.includes(lang)) {
            currentLang = lang;
            speak(`เปลี่ยนภาษาเป็น ${lang === 'th' ? 'ไทย' : 'อังกฤษ'}`, lang);
            updateStatus(`🌐 ภาษา: ${lang.toUpperCase()}`);
            if (micButton) {
                micButton.innerText = CONFIG.micButton.text[currentLang];
            }
        } else {
            speak('ไม่รองรับภาษานี้');
        }
    }

    function showHelp() {
        let helpText = '';
        if (currentLang === 'th') {
            helpText = 'คำสั่งเสียงที่รองรับ: ';
            commands.forEach(cmd => { if (cmd.langs.th) helpText += cmd.langs.th.join(', ') + '; '; });
            helpText += ' แป้นพิมพ์ลัด: กด 1 = โหลดรูป, กด 2 = โหมดครอบ, กด 3 = บันทึก';
        } else {
            helpText = 'Supported voice commands: ';
            commands.forEach(cmd => { if (cmd.langs.en) helpText += cmd.langs.en.join(', ') + '; '; });
            helpText += ' Keyboard shortcuts: press 1 = Load image, 2 = Crop mode, 3 = Save';
        }
        speak(helpText);
        updateStatus('📢 ' + helpText);
    }

    function stopListeningAndReset() {
        if (recognition && listening) recognition.stop();
        listening = false;
        isHotwordActive = false;
        if (micButton) micButton.classList.remove(CONFIG.micButton.listeningClass);
        resetVisualizer();
        updateStatus(getLocalizedText('stopped'));
    }

    // ========================== KEYBOARD SHORTCUTS ==========================
    function initKeyboardShortcuts() {
        if (!CONFIG.keyboardShortcuts) return;
        document.addEventListener('keydown', (e) => {
            const activeTag = document.activeElement?.tagName?.toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;
            const key = e.key;
            refreshElements();
            switch (key) {
                case '1': e.preventDefault(); triggerFileInput(); break;
                case '2': e.preventDefault(); if (cropBtn) clickButton(cropBtn, 'Crop mode'); else updateStatus('❌ ไม่พบปุ่มครอบ', true); break;
                case '3': e.preventDefault(); if (saveBtn) handleCriticalAction(saveBtn, 'Save Image', 'คุณต้องการบันทึกรูปภาพใช่ไหม?', 'Do you want to save the image?'); else updateStatus('❌ ไม่พบปุ่มบันทึก', true); break;
                default: break;
            }
        });
        log('Keyboard shortcuts active: 1=Load, 2=Crop, 3=Save');
    }

    // ========================== ANTI-DEVTOOLS PROTECTION ==========================
    function initAntiDevTools() {
        if (!CONFIG.enableDevToolsProtection) return;
        
        // ป้องกันคลิกขวา
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (CONFIG.debug) log('Right-click blocked');
            updateStatus('🚫 ไม่สามารถเปิดเมนูขวาได้', false);
            return false;
        });
        
        // ป้องกันแป้นพิมพ์ลัด DevTools
        document.addEventListener('keydown', (e) => {
            // F12
            if (e.key === 'F12') {
                e.preventDefault();
                showDevToolsWarning();
                return false;
            }
            // Ctrl+Shift+I (หรือ Cmd+Shift+I บน Mac)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
                e.preventDefault();
                showDevToolsWarning();
                return false;
            }
            // Ctrl+Shift+J (Console)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'J' || e.key === 'j')) {
                e.preventDefault();
                showDevToolsWarning();
                return false;
            }
            // Ctrl+U (ดูซอร์ส)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'U' || e.key === 'u')) {
                e.preventDefault();
                showDevToolsWarning();
                return false;
            }
        });
        
        function showDevToolsWarning() {
            const msg = (currentLang === 'th') 
                ? '🚫 ไม่สามารถเปิดเครื่องมือนักพัฒนาได้' 
                : '🚫 Developer tools are disabled';
            updateStatus(msg, true);
            speak(msg);
            log('DevTools access blocked');
        }
        
        log('Anti-DevTools protection enabled');
    }

    // ========================== SPEECH RECOGNITION SETUP ==========================
    function initSpeechRecognition() {
        if (!SpeechRecognition) {
            updateStatus(getLocalizedText('noMic'), true);
            if (micButton) micButton.disabled = true;
            return false;
        }
        recognition = new SpeechRecognition();
        recognition.continuous = CONFIG.recognition.continuous;
        recognition.interimResults = CONFIG.recognition.interimResults;
        recognition.lang = currentLang === 'th' ? 'th-TH' : 'en-US';
        recognition.maxAlternatives = CONFIG.recognition.maxAlternatives;

        recognition.onstart = () => {
            listening = true;
            updateStatus(getLocalizedText('listening'));
            if (micButton) micButton.classList.add(CONFIG.micButton.listeningClass);
            if (CONFIG.showVisualizer && visualizerElement) {
                let level = 0;
                const interval = setInterval(() => {
                    if (!listening) { clearInterval(interval); resetVisualizer(); return; }
                    level = (level + 1) % 6;
                    updateVisualizer(level);
                }, 200);
            }
        };

        recognition.onend = () => {
            listening = false;
            updateStatus(getLocalizedText('stopped'));
            if (micButton) micButton.classList.remove(CONFIG.micButton.listeningClass);
            resetVisualizer();
        };

        recognition.onerror = (event) => {
            let errorMsg = '';
            switch(event.error) {
                case 'not-allowed': errorMsg = getLocalizedText('permissionDenied'); break;
                case 'no-speech': errorMsg = getLocalizedText('noSpeech'); break;
                default: errorMsg = getLocalizedText('error');
            }
            speak(errorMsg);
            updateStatus(`❌ ${errorMsg}`, true);
            listening = false;
            if (micButton) micButton.classList.remove(CONFIG.micButton.listeningClass);
            resetVisualizer();
        };

        recognition.onresult = (event) => {
            const last = event.results.length - 1;
            const transcript = event.results[last][0].transcript;
            updateStatus(`📝: "${transcript}"`);
            parseCommand(transcript);
        };
        return true;
    }

    function startListening() {
        if (!recognition) { if (!initSpeechRecognition()) return; }
        if (listening) { recognition.stop(); return; }
        try {
            recognition.lang = currentLang === 'th' ? 'th-TH' : 'en-US';
            recognition.start();
        } catch(e) {
            log('Recognition start error:', e);
            initSpeechRecognition();
            try { recognition.start(); } catch(e2) { updateStatus(getLocalizedText('error'), true); }
        }
    }

    // ========================== DYNAMIC UI INJECTION (FIXED) ==========================
    function refreshElements() {
        fileInput = document.getElementById('fileInput');
        cropBtn = document.getElementById('cropBtn');
        applyBtn = document.getElementById('applyBtn');
        cancelBtn = document.getElementById('cancelBtn');
        saveBtn = document.getElementById('saveBtn');
        resetBtn = document.getElementById('resetBtn');
        statusHint = document.getElementById('statusHint');
        ratioBtns = document.querySelectorAll('.ratio-btn');
        if (!micButton || !document.getElementById(CONFIG.micButton.id)) {
            micButton = document.getElementById(CONFIG.micButton.id);
        }
    }

    function createMicButtonWithVisualizer() {
        const btn = document.createElement('button');
        btn.id = CONFIG.micButton.id;
        btn.innerText = CONFIG.micButton.text[currentLang];
        Object.assign(btn.style, CONFIG.micButton.style);
        btn.title = currentLang === 'th' ? 'คลิกแล้วพูดคำสั่ง' : 'Click and speak';
        btn.addEventListener('click', () => { if (listening) stopListeningAndReset(); else startListening(); });
        return btn;
    }

    function ensureMicButtonInjected() {
        const toolbarContainer = document.getElementById('toolbarContainer');
        if (!toolbarContainer) return false;
        
        if (document.getElementById(CONFIG.micButton.id)) {
            micButton = document.getElementById(CONFIG.micButton.id);
            refreshElements();
            return true;
        }
        
        const btn = createMicButtonWithVisualizer();
        const infoPanel = document.querySelector('.info-panel');
        
        if (infoPanel && infoPanel.parentNode === toolbarContainer) {
            toolbarContainer.insertBefore(btn, infoPanel);
        } else {
            toolbarContainer.appendChild(btn);
        }
        
        micButton = btn;
        
        if (CONFIG.showVisualizer && !document.getElementById('voiceVisualizer')) {
            visualizerElement = createVisualizer();
            if (visualizerElement) {
                if (micButton.nextSibling) {
                    toolbarContainer.insertBefore(visualizerElement, micButton.nextSibling);
                } else {
                    toolbarContainer.appendChild(visualizerElement);
                }
            }
        }
        refreshElements();
        return true;
    }

    let domObserver = null;
    function watchToolbarAndInject() {
        if (domObserver) domObserver.disconnect();
        domObserver = new MutationObserver(() => {
            if (document.getElementById('toolbarContainer')) {
                ensureMicButtonInjected();
                refreshElements();
            }
        });
        domObserver.observe(document.body, { childList: true, subtree: true });
        ensureMicButtonInjected();
        setInterval(() => refreshElements(), 2000);
    }

    // ========================== INITIALIZATION ==========================
    function init() {
        log('Initializing advanced voice module + keyboard shortcuts + anti-dev-tools');
        updateStatus(getLocalizedText('readyPrompt'));
        watchToolbarAndInject();
        if (SpeechRecognition) initSpeechRecognition();
        else updateStatus(getLocalizedText('noMic'), true);
        initKeyboardShortcuts();
        initAntiDevTools();   // ✅ เปิดใช้งานป้องกัน DevTools

        const style = document.createElement('style');
        style.textContent = `
            #${CONFIG.micButton.id}.listening {
                background-color: #10b981 !important;
                animation: pulse 1s infinite;
            }
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.7; }
                100% { opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();