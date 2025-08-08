document.addEventListener('DOMContentLoaded', function () {
    // --- 전역 변수 및 상수 ---
    const concentrations_cat = {
        butorphanol: 10, midazolam: 5, propofol: 10, alfaxalone: 10, ketamine: 100, ketamine_diluted: 10, bupivacaine: 5, lidocaine: 20,
        meloxicam_inj: 2, atropine: 0.5, norepinephrine_raw: 1, epinephrine: 1, vasopressin: 20, meloxicam_oral: 0.5, dexmedetomidine: 0.5
    };
    const pillStrengths_cat = { gabapentin: 100, amoxicillin_capsule: 250, famotidine: 10 };
    let selectedCatTubeInfo = { size: null, cuff: false, notes: '' };

    // --- 초기화 및 이벤트 리스너 ---
    initializeAll();

    function initializeAll() {
        // 이벤트 리스너 바인딩
        document.getElementById('globalPetName').addEventListener('input', updateAllTitles);
        document.getElementById('weight').addEventListener('input', calculateAll);
        document.getElementById('patient_status').addEventListener('change', calculateAll);
        document.getElementById('renal_status').addEventListener('change', calculateAll);
        document.getElementById('chill_protocol').addEventListener('change', calculateAll);
        document.getElementById('saveTabBtn').addEventListener('click', saveActiveTabAsImage);
        
        // ET Tube 탭
        document.getElementById('weight-input').addEventListener('input', calculateWeightSize);
        document.getElementById('calculate-trachea-btn').addEventListener('click', calculateTracheaSize);
        document.getElementById('trachea-input').addEventListener('keydown', (event) => { if (event.key === 'Enter') calculateTracheaSize(); });
        document.getElementById('saveCatEtTubeSelection').addEventListener('click', saveCatEtTubeSelection);
        
        // 사이클로스포린 탭
        document.getElementById('petWeightCyclo').addEventListener('input', calculateCycloDose);
        document.getElementById('durationCyclo').addEventListener('input', calculateCycloDose);

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
            calculateRemovalDate();
        }

        // 구내염 탭 차트 생성
        createStomatitisChart();

        // 초기 계산 실행
        calculateAll();
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
        if (lastChar >= 0xAC00 && lastChar <= 0xD7A3) {
            return (lastChar - 0xAC00) % 28 !== 0;
        }
        return false;
    }

    function updateAllTitles() {
        const name = document.getElementById('globalPetName').value.trim();
        const hasJongseong = hasFinalConsonant(name);
        const nameOrDefault = name || "아이";

        // 1. Stomatitis Title
        const stomatitisTitle = document.getElementById('stomatitisTitle');
        if (stomatitisTitle) {
            stomatitisTitle.innerHTML = `우리 ${nameOrDefault}${hasJongseong ? "이를" : "를"} 위한<br>만성 구내염 및 전발치 안내서`;
        }

        // 2. Cyclosporine Title
        const cyclosporineTitle = document.getElementById('cyclosporineTitle');
        if (cyclosporineTitle) {
            cyclosporineTitle.innerHTML = `✨ ${nameOrDefault}${hasJongseong ? '이의' : '의'} 사이클로스포린 복약 안내문 ✨`;
        }

        // 3. Norspan Title
        const norspanTitle = document.getElementById('norspanTitle');
        if (norspanTitle) {
            norspanTitle.innerText = `${nameOrDefault}${hasJongseong ? '이를' : '를'} 위한 통증 관리 패치 안내문`;
        }
        
        // 4. Gabapentin Title
        const gabapentinTitle = document.getElementById('gabapentinTitle');
        if (gabapentinTitle) {
            const subjectParticle = hasJongseong ? '을' : '를';
            gabapentinTitle.innerHTML = `<span>${nameOrDefault}</span><span>${subjectParticle}</span> 위한 편안한 진료 준비 안내서`;
        }
    }

    // --- 이미지 저장 ---
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
    
    // --- 계산기 및 프로토콜 ---
    function calculateAll() {
        updateCatTubeDisplay();
        const weightInput = document.getElementById('weight');
        const weight = parseFloat(weightInput.value);
        
        // 체중이 입력되지 않으면 일부 기능 비활성화
        if (!weightInput.value || isNaN(weight) || weight <= 0) {
             const weightInputTube = document.getElementById('weight-input');
            if (weightInputTube) {
                weightInputTube.value = '';
                calculateWeightSize();
            }
            // 입력값이 없을 때 계산결과 초기화
            document.getElementById('pre_op_drugs_result_cat').innerHTML = '체중을 입력해주세요.';
            document.getElementById('nerve_block_result_cat').innerHTML = '체중을 입력해주세요.';
            document.getElementById('ketamine_cri_result_cat').innerHTML = '체중을 입력해주세요.';
            document.getElementById('hypotension_protocol_cat').innerHTML = '체중을 입력해주세요.';
            document.getElementById('bradycardia_protocol_cat').innerHTML = '';
            document.getElementById('cpa_protocol_cat').innerHTML = '체중을 입력해주세요.';
            document.getElementById('discharge_cat').innerHTML = '체중을 입력해주세요.';
            document.getElementById('petWeightCyclo').value = '';
            calculateCycloDose();
            return;
        }
        
        const weightInputTube = document.getElementById('weight-input');
        if(weightInputTube) {
            weightInputTube.value = weight;
            calculateWeightSize();
        }
        
        const cycloWeightInput = document.getElementById('petWeightCyclo');
        if(cycloWeightInput) {
            cycloWeightInput.value = weight;
            calculateCycloDose();
        }
        
        populatePrepTab(weight);
        populateEmergencyTab(weight);
        populateDischargeTab(weight);
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
        const pumpCorrectionFactor = 0.7;
        const fluidRate = status === 'healthy' ? 3 : 1.5;
        const fluidTarget = fluidRate * weight;
        const fluidCorrected = fluidTarget / pumpCorrectionFactor;
        
        let patchRecommendation = "";
        if (weight <= 3.0) { patchRecommendation = "5 mcg/h 1매"; } 
        else if (weight <= 6.0) { patchRecommendation = "10 mcg/h 1매"; } 
        else { patchRecommendation = "20 mcg/h 1매"; }

        const norepiRate = (((weight * 0.1 * 60) / 1000) / (0.3 * 1 / 30));
        const epiLowMl = (0.01 * weight) / (concentrations_cat.epinephrine / 10);
        const atropineCpaMl = (0.04 * weight) / concentrations_cat.atropine;

        document.getElementById('pre_op_drugs_result_cat').innerHTML = `
            <div class="p-3 bg-blue-50 rounded-lg"><h4 class="font-bold text-blue-800">마취 전 투약</h4><p><span class="result-value">${butorMl.toFixed(2)} mL</span> 부토르파놀</p><p><span class="result-value">${midaMl.toFixed(2)} mL</span> 미다졸람</p>${isChill ? '<p class="text-xs text-red-600 font-bold mt-1">※ Chill 50% 감량</p>' : ''}</div>
            <div class="p-3 bg-amber-50 rounded-lg"><h4 class="font-bold text-amber-800">케타민 부하</h4><p><span class="result-value">${ketaLoadMl.toFixed(2)} mL</span> (희석액)</p><p class="text-xs text-gray-600 font-semibold mt-1">※ 희석: 케타민 0.1mL + N/S 0.9mL</p></div>
            <div class="p-3 bg-indigo-50 rounded-lg"><h4 class="font-bold text-indigo-800">마취 유도제</h4><p><span class="result-value">${alfaxanMlMin.toFixed(2)}~${alfaxanMlMax.toFixed(2)} mL</span> 알팍산</p>${isChill ? '<p class="text-xs text-red-600 font-bold mt-1">※ Chill 50% 감량</p>' : ''}</div>
            <div class="p-3 bg-cyan-50 rounded-lg"><h4 class="font-bold text-cyan-800">수액 펌프</h4><p><span class="result-value">${fluidCorrected.toFixed(1)} mL/hr</span></p><p class="text-xs text-gray-500 mt-1">(목표: ${fluidTarget.toFixed(1)}mL/hr)</p></div>
            <div class="p-3 bg-fuchsia-50 rounded-lg"><h4 class="font-bold text-fuchsia-800">노스판 패치</h4><p class="result-value">${patchRecommendation}</p></div>
            <div class="p-3 bg-red-50 rounded-lg col-span-full md:col-span-1"><h4 class="font-bold text-red-800">응급 약물 준비</h4>
                <p class="text-xs text-left">노르에피(CRI희석액): <span class="result-value">${(norepiRate / 60).toFixed(2)} mL</span>/min</p>
                <p class="text-xs text-left">에피(저용량,희석액): <span class="result-value">${epiLowMl.toFixed(2)} mL</span></p>
                <p class="text-xs text-left">아트로핀: <span class="result-value">${atropineCpaMl.toFixed(2)} mL</span></p>
            </div>`;

        const chillCard = document.getElementById('chill_protocol_info_card');
        if (isChill) {
            chillCard.style.display = 'block';
            document.getElementById('chill_protocol_content').innerHTML = `<div class="p-4 border rounded-lg bg-gray-50 space-y-3"><div><h4 class="font-bold text-gray-800">1. 사전 처방</h4><p><strong>가바펜틴 100mg 캡슐</strong>을 처방하여, 보호자가 병원 방문 1~2시간 전 가정에서 경구 투여하도록 안내합니다.</p></div><div><h4 class="font-bold text-gray-800">2. 원내 프로토콜</h4><p>가바펜틴을 복용한 환자는 <strong class="text-red-600">마취 전 투약 및 유도제 용량이 자동으로 50% 감량</strong>됩니다.</p></div></div>`;
        } else {
            chillCard.style.display = 'none';
        }

        const sites = parseInt(document.getElementById('cat_block_sites')?.value) || 4;
        let vol_per_site = Math.min(0.3, Math.max(0.1, 0.08 * weight));
        let total_vol_needed = vol_per_site * sites;
        const final_total_ml = Math.min((1.0 * weight / 5 * 1.25), total_vol_needed);
        document.getElementById('nerve_block_result_cat').innerHTML = `<div class="flex items-center gap-4 mb-4"><label for="cat_block_sites" class="font-semibold text-gray-700">마취 부위 수:</label><select id="cat_block_sites" class="select-field" onchange="calculateAll()"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4" selected>4</option></select></div><div class="p-2 border rounded-lg bg-gray-50"><h4 class="font-semibold text-gray-800">총 준비 용량 (${sites}군데)</h4><p class="text-xs text-red-600 font-bold">부피바케인 총량 1.0mg/kg 초과 금지!</p><p><span class="result-value">${(final_total_ml*0.8).toFixed(2)}mL</span> (0.5% 부피) + <span class="result-value">${(final_total_ml*0.2).toFixed(2)}mL</span> (2% 리도)</p></div>`;
        if (document.getElementById('cat_block_sites')) document.getElementById('cat_block_sites').value = sites;

        const cri_rate_ml_hr = weight * 0.3;
        document.getElementById('ketamine_cri_result_cat').innerHTML = `<div class="p-4 border rounded-lg bg-gray-50"><h4 class="font-semibold text-gray-800">CRI 펌프 속도 설정</h4><p class="text-xs text-gray-600">희석: 케타민(100mg/mL) 0.3mL + N/S 29.7mL</p><p class="text-sm">목표: 5 mcg/kg/min (0.3 mg/kg/hr)</p><div class="mt-2 text-red-600 font-bold text-xl">${cri_rate_ml_hr.toFixed(2)} mL/hr</div></div>`;
        
        document.getElementById('workflow_steps_cat').innerHTML = `<div class="step-card p-4"><h3 class="font-bold text-lg text-indigo-800">Step 1: 내원 및 안정화</h3><p class="text-sm text-gray-700">IV 장착 후, 수액을 연결하고 입원장 내에서 산소를 공급하며 환자를 안정시킵니다. 필요 시 노스판 패치를 미리 부착합니다.</p></div><div class="step-card p-4"><h3 class="font-bold text-lg text-indigo-800">Step 2: 마취 전 투약</h3><p class="text-sm text-gray-700">산소를 공급하며, 준비된 부토르파놀+미다졸람을 2분에 걸쳐 천천히 IV합니다.</p></div><div class="warning-card p-4"><h3 class="font-bold text-lg text-orange-800">Step 3: 마취 유도 및 케타민 로딩</h3><p class="text-sm text-gray-700">준비된 유도제를 효과를 봐가며 주사하여 삽관 후, 케타민 부하 용량을 1분에 걸쳐 천천히 IV합니다.</p></div><div class="step-card p-4"><h3 class="font-bold text-lg text-indigo-800">Step 4: 마취 유지</h3><p class="text-sm text-gray-700">호흡마취 및 케타민 CRI 펌프를 작동시키고, 모든 발치/수술 부위에 국소마취를 적용합니다.</p></div>`;
    }
    
    function populateEmergencyTab(weight) {
        const norepiDose = 0.1;
        const norepiRate = (((weight * norepiDose * 60) / 1000) / (0.3 * 1 / 30));
        document.getElementById('hypotension_protocol_cat').innerHTML = `<h4 class="font-bold text-lg text-red-800">저혈압 (SBP < 90)</h4><ol class="list-decimal list-inside mt-2 space-y-2 text-sm"><li>호흡 마취제 농도 감소</li><li><span class="text-red-600 font-bold">수액 볼루스 절대 금기!</span> 승압제 사용.</li></ol><div class="mt-2 p-2 rounded-lg bg-red-100"><h5 class="font-semibold text-center text-sm">노르에피네프린 CRI (1차)</h5><p class="text-xs text-center mb-1">희석: 원액 0.3mL + N/S 29.7mL</p><p class="text-center font-bold text-red-700 text-lg">${norepiRate.toFixed(2)} mL/hr <span class="text-sm font-normal">(0.1 mcg/kg/min)</span></p></div>`;
        document.getElementById('bradycardia_protocol_cat').innerHTML = `<h4 class="font-bold text-lg text-red-800 mt-4">서맥 (Bradycardia)</h4><div class="mt-2 p-2 rounded-lg bg-red-100"><p class="text-center text-red-700 font-bold">아트로핀 금기 (HCM 의심)</p><p class="text-center text-xs text-gray-600">마취 심도 조절 및 원인 교정 우선</p></div>`;
        const epiLowMl = (0.01 * weight) / (concentrations_cat.epinephrine / 10);
        const vasoMl = (0.8 * weight) / concentrations_cat.vasopressin;
        const atropineCpaMl = (0.04 * weight) / concentrations_cat.atropine;
        document.getElementById('cpa_protocol_cat').innerHTML = `<div class="info-box mb-2 text-xs"><p><strong>핵심 개념:</strong> BLS는 '엔진'을 계속 돌려주는 역할이고, ALS는 '엔진을 수리'하는 역할입니다. 고품질의 BLS 없이는 ALS가 성공할 수 없습니다.</p></div><h4 class="font-bold text-md text-gray-800 mt-3">1. BLS (기본소생술)</h4><ul class="list-disc list-inside text-sm space-y-1 mt-1"><li><strong>순환:</strong> 분당 100-120회 속도로 흉곽 1/3 깊이 압박 (2분마다 교대)</li><li><strong>기도확보:</strong> 즉시 기관 삽관</li><li><strong>호흡:</strong> 6초에 1회 인공 환기 (과환기 금지)</li></ul><h4 class="font-bold text-md text-gray-800 mt-3">2. ALS (전문소생술)</h4><div class="mt-2 p-2 rounded-lg bg-red-100 space-y-2"><h5 class="font-semibold text-sm">에피네프린 (Low dose)</h5><p class="text-xs text-center mb-1 font-semibold">희석: 원액 0.1mL + N/S 0.9mL</p><p class="text-center font-bold text-red-700">${epiLowMl.toFixed(2)} mL (희석액) IV</p><hr><h5 class="font-semibold text-sm">바소프레신 (대체 가능)</h5><p class="text-center font-bold text-red-700">${vasoMl.toFixed(2)} mL IV</p><hr><h5 class="font-semibold text-sm">아트로핀 (Vagal arrest 의심 시)</h5><p class="text-center font-bold text-red-700">${atropineCpaMl.toFixed(2)} mL IV</p></div>`;
    }

    function populateDischargeTab(weight) {
        const renalStatus = document.getElementById('renal_status').value;
        const generalDays = parseInt(document.getElementById('prescription_days_cat')?.value) || 7;
        const getPillCount = (mgPerDose, frequency, pillStrength, days) => { if (days <= 0) return "일수 입력"; const pillsPerDose = mgPerDose / pillStrength; const totalPills = Math.ceil(pillsPerDose * frequency * days * 2) / 2; return `<strong>${totalPills.toFixed(1).replace('.0','')}정</strong> (${pillStrength}mg/정) | 1회 ${pillsPerDose.toFixed(2)}정, ${frequency}회/일`; };
        let content = '';
        if (renalStatus === 'healthy') {
            const vetrocamDays = parseInt(document.getElementById('vetrocam_days_cat')?.value) || 3;
            let totalVetrocamDoseMl = 0;
            if (vetrocamDays >= 1) { totalVetrocamDoseMl += (0.1 * weight) / concentrations_cat.meloxicam_oral; if (vetrocamDays > 1) totalVetrocamDoseMl += (vetrocamDays - 1) * ((0.05 * weight) / concentrations_cat.meloxicam_oral); }
            const gabapentinDoseA = parseFloat(document.getElementById('gabapentin_dose_cat_a')?.value) || 5;
            content = `<div id="discharge_gold_cat"><h3 class="font-bold text-lg text-green-700 mb-2">시나리오 1: 종합 처방 (신기능 정상)</h3><div class="p-4 bg-green-50 rounded-lg space-y-2"><div><label class="font-semibold text-sm">베트로캄 처방일: <input type="number" id="vetrocam_days_cat" value="${vetrocamDays}" class="w-16 p-0.5 border rounded text-center" oninput="calculateAll()"></label></div><p><strong>베트로캄(액상, 1일 1회):</strong> 총 <span class="result-value">${totalVetrocamDoseMl.toFixed(2)} mL</span></p><hr><div><label class="font-semibold text-sm">가바펜틴 용량(mg/kg): <input type="number" id="gabapentin_dose_cat_a" value="${gabapentinDoseA}" class="w-16 p-0.5 border rounded text-center" oninput="calculateAll()"></label></div><div class="text-sm p-1 bg-green-100 rounded">${getPillCount(gabapentinDoseA * weight, 2, pillStrengths_cat.gabapentin, generalDays)}</div><hr><p class="font-semibold text-sm">항생제/위장보호제는 동일</p></div></div>`;
        } else {
             const gabapentinDoseB = parseFloat(document.getElementById('gabapentin_dose_cat_b')?.value) || 10;
             content = `<div id="discharge_alt_cat"><h3 class="font-bold text-lg text-orange-700 mb-2">시나리오 2: NSAID 제외 처방 (신기능 저하)</h3><div class="info-box mb-2 text-xs"><p class="font-bold text-red-600">NSAIDs 절대 금기!</p></div><div class="p-4 bg-orange-50 rounded-lg space-y-2"><div><label class="font-semibold text-sm">가바펜틴 용량(mg/kg): <input type="number" id="gabapentin_dose_cat_b" value="${gabapentinDoseB}" class="w-16 p-0.5 border rounded text-center" oninput="calculateAll()"></label></div><div class="text-sm p-1 bg-orange-100 rounded">${getPillCount(gabapentinDoseB * weight, 2, pillStrengths_cat.gabapentin, generalDays)}</div><hr><p class="font-semibold text-sm">항생제/위장보호제는 동일</p></div></div>`;
        }
        document.getElementById('discharge_cat').innerHTML = content;
    }

    // --- 구내염 탭 차트 ---
    function createStomatitisChart() {
        const ctx = document.getElementById('prognosisChart');
        if (!ctx) return;
        new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['완전한 회복', '현저한 개선', '부분적 개선'],
                datasets: [{
                    label: '전발치 후 예후',
                    data: [60, 25, 15],
                    backgroundColor: ['rgba(52, 211, 153, 0.8)','rgba(251, 191, 36, 0.8)','rgba(239, 68, 68, 0.8)'],
                    borderColor: ['#10b981','#f59e0b','#ef4444'],
                    borderWidth: 2,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { padding: 20 } } }
            }
        });
    }

    // --- 사이클로스포린 탭 계산기 ---
    function calculateCycloDose(){
         const doseResultDiv = document.getElementById('doseResultCyclo');
         const weightInput = document.getElementById('petWeightCyclo');
         const durationInput = document.getElementById('durationCyclo');
         
         const weight = parseFloat(weightInput.value);
         const duration = parseInt(durationInput.value);

        if (isNaN(weight) || weight <= 0) {
            doseResultDiv.innerHTML = '<p class="text-gray-700">👆 상단의 몸무게와 복용 기간을 입력하시면 자동으로 계산됩니다.</p>';
            return;
        }
        const doseInMl = (weight * 5) / 100;
        let htmlContent = `<p class="text-lg"><strong><i class="fa-solid fa-syringe"></i> 1일 권장 정량 (${weight}kg 기준)</strong></p><p class="text-4xl font-black my-2 text-indigo-600">${doseInMl.toFixed(2)} mL</p><p class="text-sm text-gray-700">(사이클로스포린 ${(weight * 5).toFixed(1)} mg에 해당)</p>`;
        if (!isNaN(duration) && duration > 0) {
            const totalVolume = doseInMl * duration;
            htmlContent += `<div class="mt-4 pt-4 border-t-2 border-dashed border-indigo-200"><p class="text-lg"><strong><i class="fa-solid fa-calendar-check"></i> 총 필요 용량 (${duration}일 기준)</strong></p><p class="text-4xl font-black my-2 text-green-600">${totalVolume.toFixed(2)} mL</p></div>`;
        }
        doseResultDiv.innerHTML = htmlContent;
    }

    // --- 노스판 탭 날짜 계산 ---
    function calculateRemovalDate() {
        const dateInput = document.getElementById('attachDate').value;
        const timeInput = document.getElementById('attachTime').value;
        const removalInfoDiv = document.getElementById('removalInfo');
        if (!dateInput || !timeInput || !removalInfoDiv) { if(removalInfoDiv) removalInfoDiv.innerHTML = '<p class="font-bold text-yellow-900">날짜와 시간을 입력해주세요.</p>'; return; }
        const attachDateTime = new Date(`${dateInput}T${timeInput}`);
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
});```