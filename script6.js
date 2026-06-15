// script6.js - ปุ่มนำทางไปยังลิงก์ที่กำหนด (หน้า 2 และ หน้า 5)
(function() {
    'use strict';

    // กำหนด URL สำหรับแต่ละปุ่มโดยตรง
    const URL_PAGE2 = 'https://grassjellyj-cpu288.github.io/Smart-Sharpen-Pro-/';
    const URL_PAGE3 = 'https://grassjellyj-cpu288.github.io/ULTIMATETROJANMAGNIFIER-/';
    const URL_PAGE4 = 'https://beautiful-rugelach-5f0408.netlify.app/';
    const URL_PAGE5 = 'https://taboonchai1991-ops.github.io/-Tro-library-BP-/';
    const URL_PAGE6 = 'https://grassjellyj-cpu288.github.io/notepad-pro/';

    // ฟังก์ชันสร้างปุ่ม
    function createNavigationButton(text, url) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.style.cssText = `
            background-color: #4f46e5;
            color: white;
            border: none;
            border-radius: 6px;
            padding: 8px 16px;
            margin: 0 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s;
        `;
        btn.addEventListener('mouseenter', () => btn.style.backgroundColor = '#6366f1');
        btn.addEventListener('mouseleave', () => btn.style.backgroundColor = '#4f46e5');
        
        btn.addEventListener('click', () => {
            window.location.href = url;
        });
        return btn;
    }

    // ฟังก์ชันแทรกปุ่มลงในหน้า
    function injectButtons() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', injectButtons);
            return;
        }

        // หา container ที่มี id="toolbarContainer" หรือสร้างใหม่
        let container = document.getElementById('toolbarContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'navButtonsContainer';
            container.style.cssText = `
                display: flex;
                justify-content: center;
                gap: 12px;
                margin: 16px 0;
                padding: 8px;
                background: #f3f4f6;
                border-radius: 12px;
            `;
            const firstChild = document.body.firstChild;
            document.body.insertBefore(container, firstChild);
        }

        // ป้องกันการเพิ่มซ้ำ
        if (document.getElementById('btnPage2')) return;

        const btn2 = createNavigationButton('🧽ลบพื้นหลัง', URL_PAGE2);
        const btn3 = createNavigationButton('ULTIMATETROJANMAGNIFIER', URL_PAGE3);
        const btn4 = createNavigationButton('รวมรููป', URL_PAGE4);
        const btn5 = createNavigationButton('พระลึกลับแดนสยาม', URL_PAGE5);
        const btn6 = createNavigationButton('notepad-pro', URL_PAGE6);
        btn2.id = 'btnPage2';
        btn3.id = 'btnPage3';
        btn4.id = 'btnPage4';
        btn5.id = 'btnPage5';
        btn6.id = 'btnPage6';


        container.appendChild(btn2);
        container.appendChild(btn3);
        container.appendChild(btn4);
        container.appendChild(btn5);
        container.appendChild(btn6);

    }

    injectButtons();
})();
