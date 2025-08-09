document.addEventListener('DOMContentLoaded', function () {
    // --- 전역 변수 및 상수 ---
    const concentrations_cat = {
        butorphanol: 10, midazolam: 5, propofol: 10, alfaxalone: 10, ketamine: 50, ketamine_diluted: 10, bupivacaine: 5, lidocaine: 20,
        meloxicam_inj: 2, atropine: 0.5, norepinephrine_raw: 1, epinephrine: 1, vasopressin: 20, meloxicam_oral: 0.5, dexmedetomidine: 0.5
    };
    const pillStrengths_cat = { gabapentin: 100, amoxicillin_capsule: 250, famotidine: 10 };
    let selectedCatTubeInfo = { size: null, cuff: false, notes: '' };

    // --- 초기화 및 이벤트 리스너 ---
    initializeAll();

    function initializeAll() {
        // 전역 이벤트 리스너 바인딩
        const globalInputs = ['globalPetName', 'weight', 'visitDate', 'patient_status', 'renal_status', 'chill_protocol', 'liverIssue', 'kidneyIssue'];
        globalInputs.forEach(id => document.getElementById(id)?.addEventListener('input', calculateAll));
        
        // 기능 버튼 이벤트 리스너
        document.getElementById('saveJsonBtn').addEventListener('click', saveDataAsJson);
        document.getElementById('loadJsonBtn').addEventListener('click', () => document.getElementById('jsonFileInput').click());
        document.getElementById('jsonFileInput').addEventListener('change', handleFileLoad);
        document.getElementById('saveImageBtn').addEventListener('click', saveActiveTabAsImage);
        
        // ET Tube 탭
        document.getElementById('weight-input')?.addEventListener('input', calculateWeightSize);
        document.getElementById('calculate-trachea-btn')?.addEventListener('click', calculateTracheaSize);
        document.getElementById('trachea-input')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') calculateTracheaSize(); });
        document.getElementById('saveCatEtTubeSelection')?.addEventListener('click', saveCatEtTubeSelection);
        
        // 사이클로스포린 탭
        document.getElementById('petWeightCyclo')?.addEventListener('input', calculateCycloDose);
        document.getElementById('durationCyclo')?.addEventListener('input', calculateCycloDose);

        // 머타자핀 탭
        document.getElementById('petWeightMirtazapine')?.addEventListener('input', calculateMirtazapineDose);
        document.getElementById('healthStatusMirtazapine')?.addEventListener('change', calculateMirtazapineDose);

        // 노스판 탭
        const attachDateEl = document.getElementById('attachDate');
        const attachTimeEl = document.getElementById('attachTime');
        if(attachDateEl && attachTimeEl){
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            attachDateEl.value = now.toISOString().slice(0,10);
            attachTimeEl.value = now.toISOString().slice(11,16);
            attachDateEl.addEventListener('change', calculateRemovalDate);
            attachTimeEl.addEventListener('change', calculateRemovalDate);
        }

        // 구내염 탭 차트 생성
        createStomatitisChart();

        // 퇴원약 탭 초기화
        initializeDischargeTab();
        
        // 오늘 날짜로 방문날짜 초기화
        document.getElementById('visitDate').valueAsDate = new Date();

        // 초기 계산 실행
        calculateAll();
        calculateRemovalDate();
    }

    // --- 탭 기능 ---
    window.openTab = function(evt, tabName) {
        let i, tabcontent, tablinks;
        tabcontent = document.getElementsByClassName("tab-content");
        for (i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
            tabcontent[i].classList.remove('active');
        }
        tablinks = document.getElementsByClassName("tab-button");
        for (i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace(" active", "");
        }
        const activeTab = document.getElementById(tabName);
        activeTab.style.display = "block";
        activeTab.classList.add('active');
        evt.currentTarget.className += " active";
    }

    // --- 전역 이름 연동 ---
    function hasFinalConsonant(name) {
        if (!name) return false;
        const lastChar = name.charCodeAt(name.length - 1);
        return (lastChar >= 0xAC00 && lastChar <= 0xD7A3) ? (lastChar - 0xAC00) % 28 !== 0 : false;
    }

    function updateAllTitles() {
        const name = document.getElementById('globalPetName').value.trim();
        const hasJongseong = hasFinalConsonant(name);
        const nameOrDefault = name || "아이";
        const subjectParticle = hasJongseong ? '을' : '를';

        const titles = {
            stomatitisTitle: `우리 ${nameOrDefault}${hasJongseong ? "이를" : "를"} 위한<br>만성 구내염 및 전발치 안내서`,
            cyclosporineTitle: `✨ ${nameOrDefault}${hasJongseong ? '이의' : '의'} 사이클로스포린 복약 안내문 ✨`,
            norspanTitle: `${nameOrDefault}${hasJongseong ? '이를' : '를'} 위한 통증 관리 패치 안내문`,
            gabapentinTitle: `<span>${nameOrDefault}</span><span>${subjectParticle}</span> 위한 편안한 진료 준비 안내서`
        };

        for (const id in titles) {
            const element = document.getElementById(id);
            if (element) element.innerHTML = titles[id];
        }
    }

    // --- 데이터 저장/불러오기/이미지 기능 (수정됨) ---
    function gatherDashboardData() {
        try {
            const dischargeMeds = [];
            document.querySelectorAll('#dischargeTab .med-table tbody tr').forEach(row => {
                const medCheckbox = row.querySelector('.med-checkbox');
                const daysInput = row.querySelector('.days');
                const doseInput = row.querySelector('.dose');

                if (row.dataset.drug && medCheckbox && daysInput) {
                    dischargeMeds.push({
                        drug: row.dataset.drug,
                        selected: medCheckbox.checked,
                        days: daysInput.value,
                        dose: doseInput ? doseInput.value : null
                    });
                }
            });

            return {
                visitDate: document.getElementById('visitDate')?.value || '',
                petName: document.getElementById('globalPetName')?.value || '',
                weight: document.getElementById('weight')?.value || '',
                patientStatus: document.getElementById('patient_status')?.value || 'healthy',
                renalStatus: document.getElementById('renal_status')?.value || 'healthy',
                chillProtocol: document.getElementById('chill_protocol')?.value || 'no',
                liverIssue: document.getElementById('liverIssue')?.checked || false,
                kidneyIssue: document.getElementById('kidneyIssue')?.checked || false,
                etTubeInfo: selectedCatTubeInfo,
                dischargeMeds: dischargeMeds,
                etTubeNotes: document.getElementById('cat_selectedEtTubeNotes')?.value || '',
                norspanAttachDate: document.getElementById('attachDate')?.value || '',
                norspanAttachTime: document.getElementById('attachTime')?.value || ''
            };
        } catch (error) {
            console.error("Error in gatherDashboardData:", error);
            alert("데이터를 수집하는 중 오류가 발생했습니다. 개발자 콘솔을 확인해주세요.");
            return null;
        }
    }

    function applyDashboardData(data) {
        try {
            if (!data) return;
            document.getElementById('visitDate').value = data.visitDate || new Date().toISOString().slice(0, 10);
            document.getElementById('globalPetName').value = data.petName || '';
            document.getElementById('weight').value = data.weight || '';
            document.getElementById('patient_status').value = data.patientStatus || 'healthy';
            document.getElementById('renal_status').value = data.renalStatus || 'healthy';
            document.getElementById('chill_protocol').value = data.chillProtocol || 'no';
            document.getElementById('liverIssue').checked = data.liverIssue || false;
            document.getElementById('kidneyIssue').checked = data.kidneyIssue || false;

            selectedCatTubeInfo = data.etTubeInfo || { size: null, cuff: false, notes: '' };
            document.getElementById('cat_selectedEtTubeSize').value = selectedCatTubeInfo.size || '';
            document.getElementById('cat_selectedEtTubeCuff').checked = selectedCatTubeInfo.cuff || false;
            document.getElementById('cat_selectedEtTubeNotes').value = selectedCatTubeInfo.notes || '';

            if (data.dischargeMeds && Array.isArray(data.dischargeMeds)) {
                data.dischargeMeds.forEach(savedMed => {
                    const row = document.querySelector(`#dischargeTab tr[data-drug="${savedMed.drug}"]`);
                    if (row) {
                        row.querySelector('.med-checkbox').checked = savedMed.selected;
                        row.querySelector('.days').value = savedMed.days;
                        const doseInput = row.querySelector('.dose');
                        if (doseInput && savedMed.dose !== null) doseInput.value = savedMed.dose;
                    }
                });
            }
            
            document.getElementById('attachDate').value = data.norspanAttachDate || '';
            document.getElementById('attachTime').value = data.norspanAttachTime || '';

            calculateAll();
            alert('기록을 성공적으로 불러왔습니다.');
        } catch (error) {
            console.error("Error applying data:", error);
            alert("데이터를 적용하는 중 오류가 발생했습니다. 파일이 손상되었을 수 있습니다.");
        }
    }

    function saveDataAsJson() {
        try {
            const data = gatherDashboardData();
            if (!data) return;

            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            
            const petName = data.petName || '환자';
            const date = data.visitDate || new Date().toISOString().slice(0, 10);
            
            link.href = url;
            link.download = `${date}_${petName}_고양이마취기록.json`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error in saveDataAsJson:", error);
            alert("파일을 저장하는 중 오류가 발생했습니다. 개발자 콘솔을 확인해주세요.");
        }
    }

    function handleFileLoad(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                applyDashboardData(data);
            } catch (error) {
                alert('오류: 유효하지 않은 JSON 파일입니다.');
                console.error("JSON 파싱 오류:", error);
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // 동일한 파일을 다시 불러올 수 있도록 초기화
    }
    
    function saveActiveTabAsImage() {
        const activeTab = document.querySelector('.tab-content.active');
        if (!activeTab) return;
        const petName = document.getElementById('globalPetName').value.trim() || '환자';
        const tabId = activeTab.id || 'current_tab';
        const fileName = `${petName}_${tabId}_안내문.png`;
        
        html2canvas(activeTab, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
        }).then(canvas => {
            const image = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = image;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }
    
    // --- 메인 계산기 및 프로토콜 ---
    function calculateAll() {
        document.getElementById('kidneyIssue').checked = (document.getElementById('renal_status').value === 'renal');
        
        updateAllTitles();
        updateCatTubeDisplay();
        const weightInput = document.getElementById('weight');
        const weight = parseFloat(weightInput.value);
        
        if (!weightInput.value || isNaN(weight) || weight <= 0) {
            const elementsToClear = ['pre_op_drugs_result_cat', 'nerve_block_result_cat', 'ketamine_cri_result_cat', 'hypotension_protocol_cat', 'cpa_protocol_cat'];
            elementsToClear.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = '체중을 입력해주세요.';
            });
            const bradycardiaEl = document.getElementById('bradycardia_protocol_cat');
            if (bradycardiaEl) bradycardiaEl.innerHTML = '';
            
            if (document.getElementById('weight-input')) {
                document.getElementById('weight-input').value = '';
                calculateWeightSize();
            }
            if (document.getElementById('petWeightCyclo')) {
                document.getElementById('petWeightCyclo').value = '';
                calculateCycloDose();
            }
            if (document.getElementById('petWeightMirtazapine')) {
                document.getElementById('petWeightMirtazapine').value = '';
                calculateMirtazapineDose();
            }
            calculateDischargeMeds(); 
            return;
        }
        
        if(document.getElementById('weight-input')) {
            document.getElementById('weight-input').value = weight;
            calculateWeightSize();
        }
        if(document.getElementById('petWeightCyclo')) {
            document.getElementById('petWeightCyclo').value = weight;
            calculateCycloDose();
        }
        if(document.getElementById('petWeightMirtazapine')) {
            document.getElementById('petWeightMirtazapine').value = weight;
            calculateMirtazapineDose();
        }
        
        populatePrepTab(weight);
        populateEmergencyTab(weight);
        calculateDischargeMeds();
    }

    function populatePrepTab(weight) {
        const status = document.getElementById('patient_status').value;
        const isChill = document.getElementById('chill_protocol').value === 'yes';
        const premedFactor = isChill ? 0.5 : 1.0;
        const inductionFactor = isChill ? 0.5 : 1.0;

        const butorMl = (0.2 * weight * premedFactor) / concentrations_cat.butorphanol;
        const midaMl = (0.2 * weight * premedFactor) / concentrations_cat.midazolam;
        const ketaLoadMl = (0.5 * weight) / concentrations_cat.ketamine_diluted;
        const alfaxanMlMin = (1 * weight * inductionFactor) / concentrations_cat.alfaxalone;
        const alfaxanMlMax = (2 * weight * inductionFactor) / concentrations_cat.alfaxalone;
        const fluidRate = status === 'healthy' ? 3 : 1.5;
        const fluidTarget = fluidRate * weight;
        
        let patchRecommendation = (weight <= 3.0) ? "5 mcg/h 1매" : (weight <= 6.0) ? "10 mcg/h 1매" : "20 mcg/h 1매";

        document.getElementById('pre_op_drugs_result_cat').innerHTML = `
            <div class="p-3 bg-blue-50 rounded-lg"><h4 class="font-bold text-blue-800">마취 전 투약</h4><p><span class="result-value">${butorMl.toFixed(2)} mL</span> 부토르파놀</p><p><span class="result-value">${midaMl.toFixed(2)} mL</span> 미다졸람</p>${isChill ? '<p class="text-xs text-red-600 font-bold mt-1">※ Chill 50% 감량</p>' : ''}</div>
            <div class="p-3 bg-amber-50 rounded-lg"><h4 class="font-bold text-amber-800">케타민 부하</h4><p><span class="result-value">${ketaLoadMl.toFixed(2)} mL</span> (희석액)</p><p class="text-xs text-gray-600 font-semibold mt-1">※ 희석: 케타민(50주) 0.2mL + N/S 0.8mL</p></div>
            <div class="p-3 bg-indigo-50 rounded-lg"><h4 class="font-bold text-indigo-800">마취 유도제</h4><p><span class="result-value">${alfaxanMlMin.toFixed(2)}~${alfaxanMlMax.toFixed(2)} mL</span> 알팍산</p>${isChill ? '<p class="text-xs text-red-600 font-bold mt-1">※ Chill 50% 감량</p>' : ''}</div>
            <div class="p-3 bg-cyan-50 rounded-lg"><h4 class="font-bold text-cyan-800">수액 속도</h4><p><span class="result-value">${fluidTarget.toFixed(1)} mL/hr</span></p></div>
            <div class="p-3 bg-fuchsia-50 rounded-lg"><h4 class="font-bold text-fuchsia-800">노스판 패치</h4><p class="result-value">${patchRecommendation}</p></div>`;

        document.getElementById('chill_protocol_info_card').style.display = isChill ? 'block' : 'none';
        if (isChill) {
            document.getElementById('chill_protocol_content').innerHTML = `<div class="p-4 border rounded-lg bg-gray-50 space-y-3"><div><h4 class="font-bold text-gray-800">1. 사전 처방</h4><p><strong>가바펜틴 100mg 캡슐</strong>을 처방하여, 보호자가 병원 방문 1~2시간 전 가정에서 경구 투여하도록 안내합니다.</p></div><div><h4 class="font-bold text-gray-800">2. 원내 프로토콜</h4><p>가바펜틴을 복용한 환자는 <strong class="text-red-600">마취 전 투약 및 유도제 용량이 자동으로 50% 감량</strong>됩니다.</p></div></div>`;
        }

        const sitesSelect = document.getElementById('cat_block_sites');
        const sites = sitesSelect ? parseInt(sitesSelect.value) || 4 : 4;
        const total_vol_needed = Math.min(0.3, Math.max(0.1, 0.08 * weight)) * sites;
        const final_total_ml = Math.min((1.0 * weight / 5 * 1.25), total_vol_needed);
        document.getElementById('nerve_block_result_cat').innerHTML = `<div class="flex items-center gap-4 mb-4"><label for="cat_block_sites" class="font-semibold text-gray-700">마취 부위 수:</label><select id="cat_block_sites" class="select-field" onchange="calculateAll()"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4" selected>4</option></select></div><div class="p-2 border rounded-lg bg-gray-50"><h4 class="font-semibold text-gray-800">총 준비 용량 (${sites}군데)</h4><p class="text-xs text-red-600 font-bold">부피바케인 총량 1.0mg/kg 초과 금지!</p><p><span class="result-value">${(final_total_ml*0.8).toFixed(2)}mL</span> (0.5% 부피) + <span class="result-value">${(final_total_ml*0.2).toFixed(2)}mL</span> (2% 리도)</p></div>`;
        if (document.getElementById('cat_block_sites')) document.getElementById('cat_block_sites').value = sites;

        const cri_rate_ml_hr = weight * 0.3;
        document.getElementById('ketamine_cri_result_cat').innerHTML = `<div class="p-4 border rounded-lg bg-gray-50"><h4 class="font-semibold text-gray-800">CRI 펌프 속도 설정</h4><p class="text-xs text-gray-600">희석: 케타민(50주) 0.6mL + N/S 29.4mL</p><p class="text-sm">목표: 5 mcg/kg/min (0.3 mg/kg/hr)</p><div class="mt-2 text-red-600 font-bold text-xl">${cri_rate_ml_hr.toFixed(2)} mL/hr</div></div>`;
        
        document.getElementById('workflow_steps_cat').innerHTML = `<div class="step-card p-4"><h3 class="font-bold text-lg text-indigo-800">Step 1: 내원 및 안정화</h3><p class="text-sm text-gray-700">IV 장착 후, 수액을 연결하고 입원장 내에서 산소를 공급하며 환자를 안정시킵니다. 필요 시 노스판 패치를 미리 부착합니다.</p></div><div class="step-card p-4"><h3 class="font-bold text-lg text-indigo-800">Step 2: 마취 전 투약</h3><p class="text-sm text-gray-700">산소를 공급하며, 준비된 부토르파놀+미다졸람을 2분에 걸쳐 천천히 IV합니다.</p></div><div class="warning-card p-4"><h3 class="font-bold text-lg text-orange-800">Step 3: 마취 유도 및 케타민 로딩</h3><p class="text-sm text-gray-700">준비된 유도제를 효과를 봐가며 주사하여 삽관 후, 케타민 부하 용량을 1분에 걸쳐 천천히 IV합니다.</p></div><div class="step-card p-4"><h3 class="font-bold text-lg text-indigo-800">Step 4: 마취 유지</h3><p class="text-sm text-gray-700">호흡마취 및 케타민 CRI 펌프를 작동시키고, 모든 발치/수술 부위에 국소마취를 적용합니다.</p></div>`;
    }
    
    function populateEmergencyTab(weight) {
        const norepiRate = (((weight * 0.1 * 60) / 1000) / (0.3 * 1 / 30));
        document.getElementById('hypotension_protocol_cat').innerHTML = `<h4 class="font-bold text-lg text-red-800">저혈압 (SBP < 90)</h4><ol class="list-decimal list-inside mt-2 space-y-2 text-sm"><li>호흡 마취제 농도 감소</li><li><span class="text-red-600 font-bold">수액 볼루스 절대 금기!</span> 승압제 사용.</li></ol><div class="mt-2 p-2 rounded-lg bg-red-100"><h5 class="font-semibold text-center text-sm">노르에피네프린 CRI (1차)</h5><p class="text-xs text-center mb-1">희석: 원액 0.3mL + N/S 29.7mL</p><p class="text-center font-bold text-red-700 text-lg">${norepiRate.toFixed(2)} mL/hr <span class="text-sm font-normal">(0.1 mcg/kg/min)</span></p></div>`;
        document.getElementById('bradycardia_protocol_cat').innerHTML = `<h4 class="font-bold text-lg text-red-800 mt-4">서맥 (Bradycardia)</h4><div class="mt-2 p-2 rounded-lg bg-red-100"><p class="text-center text-red-700 font-bold">아트로핀 금기 (HCM 의심)</p><p class="text-center text-xs text-gray-600">마취 심도 조절 및 원인 교정 우선</p></div>`;
        const epiLowMl = (0.01 * weight) / (concentrations_cat.epinephrine / 10);
        const vasoMl = (0.8 * weight) / concentrations_cat.vasopressin;
        const atropineCpaMl = (0.04 * weight) / concentrations_cat.atropine;
        document.getElementById('cpa_protocol_cat').innerHTML = `<div class="info-box mb-2 text-xs"><p><strong>핵심 개념:</strong> BLS는 '엔진'을 계속 돌려주는 역할이고, ALS는 '엔진을 수리'하는 역할입니다. 고품질의 BLS 없이는 ALS가 성공할 수 없습니다.</p></div><h4 class="font-bold text-md text-gray-800 mt-3">1. BLS (기본소생술)</h4><ul class="list-disc list-inside text-sm space-y-1 mt-1"><li><strong>순환:</strong> 분당 100-120회 속도로 흉곽 1/3 깊이 압박 (2분마다 교대)</li><li><strong>기도확보:</strong> 즉시 기관 삽관</li><li><strong>호흡:</strong> 6초에 1회 인공 환기 (과환기 금지)</li></ul><h4 class="font-bold text-md text-gray-800 mt-3">2. ALS (전문소생술)</h4><div class="mt-2 p-2 rounded-lg bg-red-100 space-y-2"><h5 class="font-semibold text-sm">에피네프린 (Low dose)</h5><p class="text-xs text-center mb-1 font-semibold">희석: 원액 0.1mL + N/S 0.9mL</p><p class="text-center font-bold text-red-700">${epiLowMl.toFixed(2)} mL (희석액) IV</p><hr><h5 class="font-semibold text-sm">바소프레신 (대체 가능)</h5><p class="text-center font-bold text-red-700">${vasoMl.toFixed(2)} mL IV</p><hr><h5 class="font-semibold text-sm">아트로핀 (Vagal arrest 의심 시)</h5><p class="text-center font-bold text-red-700">${atropineCpaMl.toFixed(2)} mL IV</p></div>`;
    }
    
    // --- 퇴원약 탭 기능 ---
    function initializeDischargeTab() {
        const dischargeInputs = document.querySelectorAll('#dischargeTab .med-checkbox, #dischargeTab .days, #dischargeTab .dose');
        dischargeInputs.forEach(input => {
            input.addEventListener('change', calculateDischargeMeds);
            input.addEventListener('keyup', calculateDischargeMeds);
        });
    }

    function calculateDischargeMeds() {
        const weight = parseFloat(document.getElementById('weight').value);
        if (isNaN(weight) || weight <= 0) {
             document.getElementById('summary').innerHTML = '<p>상단의 환자 체중을 입력해주세요.</p>';
             document.querySelectorAll('#dischargeTab .total-amount').forEach(el => el.textContent = '');
             return;
        }

        const summaryData = {};
        document.querySelectorAll('#dischargeTab .med-checkbox:checked').forEach(checkbox => {
            const row = checkbox.closest('tr');
            const drugName = row.cells[1].textContent;
            const days = parseInt(row.querySelector('.days').value);
            const unit = row.dataset.unit;
            let totalAmountText = '';
            let dailyMultiplier = 2;

            if (row.dataset.special === 'vetrocam') {
                dailyMultiplier = 1;
                const totalAmount = (days > 0) ? (weight * 0.2) + (weight * 0.1 * (days - 1)) : 0;
                totalAmountText = `${totalAmount.toFixed(2)} ${unit}`;
            } else if (row.dataset.special === 'same') {
                dailyMultiplier = 1;
                totalAmountText = `${((weight / 2.5) * 0.25 * days).toFixed(1)} ${unit}`;
            } else if (row.dataset.special === 'paramel') {
                totalAmountText = `${(weight * 0.75 * 2 * days).toFixed(1)} ${unit}`;
            } else {
                const dose = parseFloat(row.querySelector('.dose').value);
                const strength = parseFloat(row.dataset.strength);
                if (!isNaN(dose) && !isNaN(strength) && strength > 0) {
                    if (!['udca', 'silymarin', 'itraconazole'].includes(row.dataset.drug)) dailyMultiplier = 2;
                    totalAmountText = `${((weight * dose * dailyMultiplier * days) / strength).toFixed(1)} ${unit}`;
                } else {
                    totalAmountText = "용량/함량 오류";
                }
            }
            
            row.querySelector('.total-amount').textContent = totalAmountText;

            if (!summaryData[days]) summaryData[days] = [];
            let summaryText = `${drugName.split(' (')[0]} ${totalAmountText}${dailyMultiplier === 1 ? ' (1일 1회)' : ''}`;
            const isLiverDanger = row.querySelector('.notes[data-liver="true"]') && document.getElementById('liverIssue').checked;
            const isKidneyDanger = row.querySelector('.notes[data-kidney="true"]') && document.getElementById('kidneyIssue').checked;

            summaryData[days].push({ text: summaryText, isDanger: isLiverDanger || isKidneyDanger });
        });

        updateSummaryUI(summaryData);
        updateDischargeWarnings();
    }

    function updateSummaryUI(summaryData) {
        const summaryContainer = document.getElementById('summary');
        summaryContainer.innerHTML = '';
        const sortedDays = Object.keys(summaryData).sort((a, b) => a - b);

        if (sortedDays.length === 0) {
            summaryContainer.innerHTML = '<p>조제할 약물을 선택해주세요.</p>';
            return;
        }

        sortedDays.forEach(day => {
            const box = document.createElement('div');
            box.className = 'summary-box';
            box.innerHTML = `<h3>${day}일 처방</h3>`;
            summaryData[day].forEach(item => {
                const p = document.createElement('p');
                p.className = 'summary-item';
                p.innerHTML = item.isDanger ? `<span class="danger">${item.text}</span>` : item.text;
                box.appendChild(p);
            });
            summaryContainer.appendChild(box);
        });
    }

    function updateDischargeWarnings() {
        const liverIssue = document.getElementById('liverIssue').checked;
        const kidneyIssue = document.getElementById('kidneyIssue').checked;
        document.querySelectorAll('#dischargeTab .notes').forEach(noteCell => {
            noteCell.classList.remove('highlight-warning');
            if ((liverIssue && noteCell.dataset.liver) || (kidneyIssue && noteCell.dataset.kidney)) {
                noteCell.classList.add('highlight-warning');
            }
        });
    }

    // --- 구내염 탭 차트 ---
    function createStomatitisChart() {
        const ctx = document.getElementById('prognosisChart');
        if (!ctx) return;
        new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['완전한 회복', '현저한 개선', '부분적 개선'],
                datasets: [{ data: [60, 25, 15], backgroundColor: ['#22c55e', '#f59e0b', '#ef4444'], borderWidth: 2 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 20 } } } }
        });
    }

    // --- 사이클로스포린 탭 계산기 ---
    function calculateCycloDose(){
        const doseResultDiv = document.getElementById('doseResultCyclo');
        const weight = parseFloat(document.getElementById('petWeightCyclo').value);
        const duration = parseInt(document.getElementById('durationCyclo').value);
        if (isNaN(weight) || weight <= 0) {
            doseResultDiv.innerHTML = '<p class="text-gray-700">👆 상단의 몸무게와 복용 기간을 입력하시면 자동으로 계산됩니다.</p>';
            return;
        }
        const doseInMl = (weight * 5) / 100;
        let htmlContent = `<p class="text-lg"><strong><i class="fa-solid fa-syringe"></i> 1일 권장 정량 (${weight}kg 기준)</strong></p><p class="text-4xl font-black my-2 text-indigo-600">${doseInMl.toFixed(2)} mL</p><p class="text-sm text-gray-700">(사이클로스포린 ${(weight * 5).toFixed(1)} mg에 해당)</p>`;
        if (!isNaN(duration) && duration > 0) {
            htmlContent += `<div class="mt-4 pt-4 border-t-2 border-dashed border-indigo-200"><p class="text-lg"><strong><i class="fa-solid fa-calendar-check"></i> 총 필요 용량 (${duration}일 기준)</strong></p><p class="text-4xl font-black my-2 text-green-600">${(doseInMl * duration).toFixed(2)} mL</p></div>`;
        }
        doseResultDiv.innerHTML = htmlContent;
    }
    
    // --- 머타자핀 탭 계산기 (용액 기준 수정) ---
    function calculateMirtazapineDose() {
        const doseResultDiv = document.getElementById('doseResultMirtazapine');
        const weight = parseFloat(document.getElementById('petWeightMirtazapine').value);
        const status = document.getElementById('healthStatusMirtazapine').value;

        if (isNaN(weight) || weight <= 0) {
            doseResultDiv.innerHTML = `
                <p class="text-gray-700 text-center mb-4">👆 상단의 체중과 환자 상태를 선택하시면 권장 용량이 계산됩니다.</p>
                <div class="blur-sm">${generateMirtazapineHtmlContent(4, 'healthy')}</div>
            `;
            return;
        }
        
        doseResultDiv.innerHTML = generateMirtazapineHtmlContent(weight, status);
    }

    function generateMirtazapineHtmlContent(weight, status) {
        const frequency = (status === 'healthy') ? "매 48시간 (2일)" : "매 72시간 (3일)";
        const finalVolumeMl = 1.0;
        const transdermalDoseMg = 2;
        const transdermalFrequency = "매 24시간 (1일)";

        return `
            <div class="p-4 rounded-lg bg-blue-50 border border-blue-200 mb-6">
                <h4 class="font-bold text-lg text-center text-blue-700 mb-2">✅ 최종 투여량 (${weight}kg)</h4>
                <p class="text-center"><strong class="text-3xl font-bold text-blue-600">${finalVolumeMl.toFixed(2)} mL/cat</strong></p>
                <p class="text-center mt-2"><strong>투여 간격:</strong> <span class="font-semibold text-red-600">${frequency}</span>마다 1회</p>
            </div>
            
            <div class="mt-6">
                <h4 class="font-semibold text-gray-800 mb-2">📜 1.875mg/mL 용액 조제법 (보호자 안내용)</h4>
                <ol class="list-decimal list-inside space-y-3 bg-gray-50 p-4 rounded-lg border">
                    <li><strong>준비물:</strong> 레메론정 15mg 1알, 10mL 주사기, 물, 차광 약병</li>
                    <li><strong>용해:</strong> 10mL 주사기에 <strong>레메론 15mg 1알</strong>을 넣고, <strong>물 8mL</strong>를 정확히 채웁니다.</li>
                    <li><strong>혼합:</strong> 주사기 입구를 막고 약이 완전히 녹아 뿌연 현탁액이 될 때까지 충분히 흔들어줍니다.</li>
                    <li><strong>확인:</strong> 이제 용액은 1mL 당 1.875mg의 머타자핀을 함유합니다. <span class="text-xs font-mono">(15mg ÷ 8mL = 1.875mg/mL)</span></li>
                </ol>
            </div>

            <div class="mt-6">
                <h4 class="font-semibold text-gray-800 mb-2">🚨 투여 및 보관 시 핵심 주의사항</h4>
                <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4 space-y-2">
                    <p><strong>사용 전 반드시 흔들기:</strong> 입자가 가라앉으므로 투여 직전 잘 흔들어 농도를 균일하게 해야 합니다.</p>
                    <p><strong>냉장 및 차광 보관:</strong> 빛에 약하므로 차광 약병에 담아 반드시 냉장 보관해야 합니다.</p>
                    <p><strong>3~4일마다 새로 조제:</strong> 물에 녹인 약은 변질될 수 있으므로, 3~4일 간격으로 새로 조제해야 안전합니다.</p>
                </div>
            </div>

            <div class="mt-8 pt-4 border-t">
                 <div class="p-4 rounded-lg bg-green-50 border border-green-200">
                    <h4 class="font-bold text-lg text-center text-green-700 mb-2">💡 대안: 경피용 연고 (Transdermal)</h4>
                    <p class="text-center"><strong class="text-2xl font-bold text-green-600">${transdermalDoseMg} mg/cat</strong> (제품에 표시된 1회용 길이)</p>
                    <p class="text-center mt-2"><strong>투여 간격:</strong> <span class="font-semibold">${transdermalFrequency}</span>마다 1회</p>
                </div>
            </div>
        `;
    }

    // --- 노스판 탭 날짜 계산 ---
    function calculateRemovalDate() {
        const dateInput = document.getElementById('attachDate');
        const timeInput = document.getElementById('attachTime');
        const removalInfoDiv = document.getElementById('removalInfo');
        if(!dateInput || !timeInput || !removalInfoDiv) return;
        if (!dateInput.value || !timeInput.value) { removalInfoDiv.innerHTML = '<p class="font-bold text-yellow-900">날짜와 시간을 입력해주세요.</p>'; return; }
        const attachDateTime = new Date(`${dateInput.value}T${timeInput.value}`);
        if (isNaN(attachDateTime.getTime())) { removalInfoDiv.innerHTML = '<p class="font-bold text-red-700">유효한 날짜와 시간을 입력해주세요.</p>'; return; }
        const removalDateStart = new Date(attachDateTime.getTime() + 72 * 3600 * 1000);
        const removalDateEnd = new Date(attachDateTime.getTime() + 96 * 3600 * 1000);
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true };
        removalInfoDiv.innerHTML = `<h4 class="text-lg font-bold text-gray-800 mb-2">🗓️ 패치 제거 권장 기간</h4><p class="text-base text-gray-700"><strong class="text-blue-600">${new Intl.DateTimeFormat('ko-KR', options).format(removalDateStart)}</strong> 부터<br><strong class="text-blue-600">${new Intl.DateTimeFormat('ko-KR', options).format(removalDateEnd)}</strong> 사이에<br>패치를 제거해주세요.</p>`;
    }
    
    // --- ET Tube 탭 계산기 ---
    const weightSizeGuideCat = [ { weight: 2.5, size: '3.0' }, { weight: 4, size: '3.5' }, { weight: 5.5, size: '4.0' }, { weight: 99, size: '4.5' } ];
    const tracheaSizeGuideCat = [ { diameter: 5.13, id: '2.5' }, { diameter: 5.88, id: '3.0' }, { diameter: 6.63, id: '3.5' }, { diameter: 7.50, id: '4.0' }, { diameter: 8.13, id: '4.5' }];

    function calculateWeightSize() {
        const weightInput = document.getElementById('weight-input');
        const resultContainerWeight = document.getElementById('result-container-weight');
        const resultTextWeight = document.getElementById('result-text-weight');
        if(!weightInput || !resultContainerWeight || !resultTextWeight) return;
        
        const weight = parseFloat(weightInput.value);
        if (isNaN(weight) || weight <= 0) { resultContainerWeight.classList.add('hidden'); return; }
        let recommendedSize = '4.5 이상';
        for (let i = 0; i < weightSizeGuideCat.length; i++) { if (weight <= weightSizeGuideCat[i].weight) { recommendedSize = weightSizeGuideCat[i].size; break; } }
        resultTextWeight.textContent = recommendedSize;
        resultContainerWeight.classList.remove('hidden');
    }

    function calculateTracheaSize() {
        const tracheaInput = document.getElementById('trachea-input');
        const resultContainerTrachea = document.getElementById('result-container-trachea');
        const resultTextTrachea = document.getElementById('result-text-trachea');
         if(!tracheaInput || !resultContainerTrachea || !resultTextTrachea) return;

        const diameter = parseFloat(tracheaInput.value);
        if (isNaN(diameter) || diameter <= 0) { resultContainerTrachea.classList.add('hidden'); return; }
        let recommendedId = '4.5 이상';
         for (let i = 0; i < tracheaSizeGuideCat.length; i++) { if (diameter <= tracheaSizeGuideCat[i].diameter) { recommendedId = tracheaSizeGuideCat[i].id; break; } }
        resultTextTrachea.textContent = recommendedId;
        resultContainerTrachea.classList.remove('hidden');
    }

    function saveCatEtTubeSelection() {
        const sizeInput = document.getElementById('cat_selectedEtTubeSize');
        if (!sizeInput.value) { alert('최종 ET Tube 사이즈를 입력해주세요.'); sizeInput.focus(); return; }
        selectedCatTubeInfo.size = parseFloat(sizeInput.value);
        selectedCatTubeInfo.cuff = document.getElementById('cat_selectedEtTubeCuff').checked;
        selectedCatTubeInfo.notes = document.getElementById('cat_selectedEtTubeNotes').value;
        const saveButton = document.getElementById('saveCatEtTubeSelection');
        saveButton.innerHTML = '<i class="fas fa-check-circle mr-2"></i>저장 완료!';
        saveButton.classList.replace('bg-blue-600', 'bg-green-600');
        setTimeout(() => {
            saveButton.innerHTML = '<i class="fas fa-save mr-2"></i>기록 저장';
            saveButton.classList.replace('bg-green-600', 'bg-blue-600');
        }, 2000);
        updateCatTubeDisplay();
    }

    function updateCatTubeDisplay() {
        const displayDiv = document.getElementById('cat_et_tube_selection_display');
        if (!displayDiv) return;
        if (selectedCatTubeInfo.size) {
            const cuffStatus = selectedCatTubeInfo.cuff ? '<span class="text-green-600 font-semibold"><i class="fas fa-check-circle mr-1"></i>확인 완료</span>' : '<span class="text-red-600 font-semibold"><i class="fas fa-times-circle mr-1"></i>미확인</span>';
            const notesText = selectedCatTubeInfo.notes ? `<p class="text-sm text-gray-600 mt-2"><strong>메모:</strong> ${selectedCatTubeInfo.notes}</p>` : '';
            displayDiv.innerHTML = `<div class="text-left grid grid-cols-1 sm:grid-cols-2 gap-x-4"><p class="text-lg"><strong>선택된 Tube 사이즈 (ID):</strong> <span class="result-value text-2xl">${selectedCatTubeInfo.size}</span></p><p class="text-lg"><strong>커프(Cuff) 확인:</strong> ${cuffStatus}</p></div>${notesText}`;
        } else {
            displayDiv.innerHTML = '<p class="text-gray-700">ET Tube가 아직 선택되지 않았습니다. \'ET Tube\' 탭에서 기록해주세요.</p>';
        }
    }
});
