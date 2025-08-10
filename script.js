// --- 전역 변수 및 상수 ---
const concentrations_cat = {
    butorphanol: 10, midazolam: 5, propofol: 10, alfaxalone: 10, ketamine: 50, ketamine_diluted: 10, bupivacaine: 5, lidocaine: 20,
    meloxicam_inj: 2, atropine: 0.5, norepinephrine_raw: 1, epinephrine: 1, vasopressin: 20, meloxicam_oral: 0.5, dexmedetomidine: 0.5
};
let selectedCatTubeInfo = { size: null, cuff: false, notes: '' };
let isDirty = false; // 저장되지 않은 변경사항을 추적하기 위한 플래그

// 마취 타이머 관련 변수
let timerInterval = null;
let elapsedTime = 0;
let startTime = 0;

// --- 초기화 및 이벤트 리스너 ---
function initializeAll() {
    // 전역 이벤트 리스너 바인딩
    const globalInputs = ['globalPetName', 'weight', 'visitDate', 'antibiotic_protocol'];
    globalInputs.forEach(id => document.getElementById(id)?.addEventListener('input', calculateAll));
    
    // 환자 상태 체크박스 이벤트 리스너
    const allStatusCheckboxes = ['statusHealthy', 'statusCardiac', 'statusLiver', 'statusKidney', 'statusChill'];
    allStatusCheckboxes.forEach(id => {
        const cb = document.getElementById(id);
        if (cb) cb.addEventListener('change', handleStatusChange);
    });
    
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

    // 공격성 고양이 탭
    document.getElementById('aggCatWeight')?.addEventListener('input', calculateAggCatProtocol);

    // 마취 타이머 버튼
    document.getElementById('start-timer-btn').addEventListener('click', startTimer);
    document.getElementById('stop-timer-btn').addEventListener('click', stopTimer);
    document.getElementById('reset-timer-btn').addEventListener('click', resetTimer);

    // 퇴원약 탭 초기화
    initializeDischargeTab();
    
    // 오늘 날짜로 방문날짜 초기화
    document.getElementById('visitDate').valueAsDate = new Date();

    // 페이지 이탈 시 저장되지 않은 변경사항 경고
    window.addEventListener('beforeunload', (event) => {
        if (isDirty) {
            event.preventDefault();
            event.returnValue = '저장되지 않은 변경사항이 있습니다. 정말로 페이지를 떠나시겠습니까?';
        }
    });

    // 초기 계산 실행
    calculateAll();
    calculateAggCatProtocol();
    setTimeout(() => { isDirty = false; }, 100);
}

// --- 마취 타이머 기능 ---
function startTimer() {
    if (timerInterval) return;
    isDirty = true;
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(updateTimer, 1000);
    document.getElementById('start-timer-btn').disabled = true;
    document.getElementById('stop-timer-btn').disabled = false;
}

function stopTimer() {
    if (!timerInterval) return;
    isDirty = true;
    clearInterval(timerInterval);
    timerInterval = null;
    elapsedTime = Date.now() - startTime;
    document.getElementById('start-timer-btn').disabled = false;
    document.getElementById('stop-timer-btn').disabled = true;
}

function resetTimer() {
    isDirty = true;
    stopTimer();
    elapsedTime = 0;
    document.getElementById('anesthesia-time-display').textContent = '00:00:00';
    document.getElementById('start-timer-btn').disabled = false;
    document.getElementById('stop-timer-btn').disabled = true;
}

function updateTimer() {
    elapsedTime = Date.now() - startTime;
    document.getElementById('anesthesia-time-display').textContent = formatTime(elapsedTime);
}

function formatTime(ms) {
    let totalSeconds = Math.floor(ms / 1000);
    let hours = Math.floor(totalSeconds / 3600);
    let minutes = Math.floor((totalSeconds % 3600) / 60);
    let seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map(v => String(v).padStart(2, '0')).join(':');
}

// --- 환자 상태 변경 핸들러 ---
function handleStatusChange(event) {
    isDirty = true;
    const changedCheckbox = event.target;
    const healthyCheckbox = document.getElementById('statusHealthy');
    const conditionCheckboxes = [
        document.getElementById('statusCardiac'),
        document.getElementById('statusLiver'),
        document.getElementById('statusKidney')
    ];

    if (changedCheckbox.id !== 'statusChill') {
        if (changedCheckbox === healthyCheckbox && healthyCheckbox.checked) {
            conditionCheckboxes.forEach(cb => { if (cb) cb.checked = false; });
        } else if (conditionCheckboxes.some(cb => cb === changedCheckbox && cb.checked)) {
            if (healthyCheckbox) healthyCheckbox.checked = false;
        }
        const isAnyDiseaseChecked = conditionCheckboxes.some(cb => cb && cb.checked);
        if (!isAnyDiseaseChecked && healthyCheckbox) {
            healthyCheckbox.checked = true;
        }
    }

    if (changedCheckbox.id === 'statusLiver') {
        const liverMeds = ['udca', 'silymarin', 'same'];
        const isLiverChecked = changedCheckbox.checked;
        liverMeds.forEach(drugName => {
            const row = document.querySelector(`#dischargeTab tr[data-drug="${drugName}"]`);
            if (row) {
                if (isLiverChecked) {
                    row.querySelector('.med-checkbox').checked = true;
                    row.querySelector('.days').value = 7;
                }
            }
        });
    }
    calculateAll();
}

// --- 메인 탭 기능 ---
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
};

// --- 데이터 저장/불러오기/이미지 기능 ---
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
            antibioticProtocol: document.getElementById('antibiotic_protocol')?.value || 'baytril50',
            statusHealthy: document.getElementById('statusHealthy')?.checked || false,
            statusCardiac: document.getElementById('statusCardiac')?.checked || false,
            statusLiver: document.getElementById('statusLiver')?.checked || false,
            statusKidney: document.getElementById('statusKidney')?.checked || false,
            statusChill: document.getElementById('statusChill')?.checked || false,
            etTubeInfo: selectedCatTubeInfo,
            dischargeMeds: dischargeMeds,
            etTubeNotes: document.getElementById('cat_selectedEtTubeNotes')?.value || '',
            totalAnesthesiaTime: elapsedTime
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
        document.getElementById('antibiotic_protocol').value = data.antibioticProtocol || 'baytril50';
        document.getElementById('statusHealthy').checked = data.statusHealthy !== undefined ? data.statusHealthy : true;
        document.getElementById('statusCardiac').checked = data.statusCardiac || false;
        document.getElementById('statusLiver').checked = data.statusLiver || false;
        document.getElementById('statusKidney').checked = data.statusKidney || false;
        document.getElementById('statusChill').checked = data.statusChill || false;
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
        if (data.totalAnesthesiaTime) {
            elapsedTime = data.totalAnesthesiaTime;
            document.getElementById('anesthesia-time-display').textContent = formatTime(elapsedTime);
        } else {
            resetTimer();
        }
        calculateAll();
        isDirty = false;
        alert('기록을 성공적으로 불러왔습니다.');
    } catch (error) {
        console.error("Error applying data:", error);
        alert("데이터를 적용하는 중 오류가 발생했습니다. 파일이 손상되었을 수 있습니다.");
    }
}

function saveDataAsJson() {
    try {
        if(timerInterval) stopTimer();
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
        isDirty = false;
        const saveButton = document.getElementById('saveJsonBtn');
        saveButton.innerHTML = '<i class="fas fa-check-circle mr-3"></i> 저장 완료!';
        setTimeout(() => {
            saveButton.innerHTML = '<i class="fas fa-save mr-3"></i> 기록 저장 (JSON)';
        }, 2000);
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
    event.target.value = '';
}
    
function saveActiveTabAsImage() {
    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab) return;
    const petName = document.getElementById('globalPetName').value.trim() || '환자';
    const tabId = activeTab.id || 'current_tab';
    const fileName = `${petName}_${tabId}_이미지.png`;
    html2canvas(activeTab, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff',
        windowWidth: activeTab.scrollWidth, windowHeight: activeTab.scrollHeight
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
    isDirty = true;
    updateCatTubeDisplay();
    const weightInput = document.getElementById('weight');
    const weight = parseFloat(weightInput.value);

    if(document.getElementById('weight-input')) document.getElementById('weight-input').value = weight;
    if(document.getElementById('aggCatWeight')) document.getElementById('aggCatWeight').value = weight;
    calculateWeightSize();
    calculateAggCatProtocol();
    
    const isCardiac = document.getElementById('statusCardiac').checked;
    const isLiver = document.getElementById('statusLiver').checked;
    const isKidney = document.getElementById('statusKidney').checked;
    const isChill = document.getElementById('statusChill').checked;

    if (!weightInput.value || isNaN(weight) || weight <= 0) {
        const elementsToClear = ['antibiotic_result', 'patch_result', 'premed_result', 'loading_dose_result', 'induction_result', 'fluid_result', 'nerve_block_result_cat', 'ketamine_cri_result_cat', 'hypotension_protocol_cat', 'bradycardia_protocol_cat', 'cpa_protocol_cat'];
        elementsToClear.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '체중을 입력해주세요.';
        });
        calculateDischargeMeds(); 
        return;
    }

    populatePrepTab(weight, isCardiac, isKidney, isLiver, isChill);
    populateEmergencyTab(weight);
    calculateDischargeMeds();
}

function populatePrepTab(weight, isCardiac, isKidney, isLiver, isChill) {
    const premedFactor = isChill ? 0.5 : 1.0;
    const inductionFactor = isChill ? 0.5 : 1.0;

    const butorMl = (0.2 * weight * premedFactor) / concentrations_cat.butorphanol;
    const midaMl = (0.2 * weight * premedFactor) / concentrations_cat.midazolam;
    const lidoMl = (1 * weight) / concentrations_cat.lidocaine;
    const ketaLoadMl = (0.5 * weight) / concentrations_cat.ketamine_diluted;
    const alfaxanMlMin = (1 * weight * inductionFactor) / concentrations_cat.alfaxalone;
    const alfaxanMlMax = (2 * weight * inductionFactor) / concentrations_cat.alfaxalone;
    const propofolMlMin = (2 * weight * inductionFactor) / concentrations_cat.propofol;
    const propofolMlMax = (6 * weight * inductionFactor) / concentrations_cat.propofol;
    
    let patchRecommendation = (weight <= 3.0) ? "5 ug/h" : (weight <= 6.0) ? "10 ug/h" : "20 ug/h";
    
    const antibioticProtocol = document.getElementById('antibiotic_protocol').value;
    let antibioticResultHtml = 'N/A';
    switch (antibioticProtocol) {
        case 'baytril50': antibioticResultHtml = `${(weight * 0.05).toFixed(2)} mL`; break;
        case 'cefronseven': antibioticResultHtml = `${(weight * 0.05).toFixed(2)} mL`; break;
        case 'baytril25': antibioticResultHtml = `${(weight * 0.1).toFixed(2)} mL`; break;
        case 'baytril50_dexa': antibioticResultHtml = `<span class="text-sm">바이트릴: ${(weight * 0.05).toFixed(2)} mL<br>덱사: ${(weight * 0.1).toFixed(2)} mL</span>`; break;
        case 'cefronseven_dexa': antibioticResultHtml = `<span class="text-sm">세프론세븐: ${(weight * 0.05).toFixed(2)} mL<br>덱사: ${(weight * 0.1).toFixed(2)} mL</span>`; break;
        case 'none': antibioticResultHtml = '선택 안함'; break;
    }
    document.getElementById('antibiotic_result').innerHTML = antibioticResultHtml;
    
    document.getElementById('patch_result').innerHTML = `${patchRecommendation} 패치 적용`;
    document.getElementById('premed_result').innerHTML = `<span class="font-bold">${butorMl.toFixed(2)} mL</span> 부토르파놀<br><span class="font-bold">${midaMl.toFixed(2)} mL</span> 미다졸람 ${isChill ? '<br><span class="text-xs text-red-600 font-bold">※ Chill 50% 감량</span>' : ''}`;
    document.getElementById('loading_dose_result').innerHTML = `<span class="font-bold">${lidoMl.toFixed(2)} mL</span> 리도카인<br><span class="font-bold">${ketaLoadMl.toFixed(2)} mL</span> 케타민(희석)<br><span class="text-xs text-gray-600 font-semibold">※ 케타민(50주) 0.2mL + N/S 0.8mL</span>`;
    let alfaxanHighlightClass = isCardiac ? 'highlight-recommend' : '';
    document.getElementById('induction_result').innerHTML = `<div class="${alfaxanHighlightClass} p-1 rounded-md">알팍산: <span class="font-bold">${alfaxanMlMin.toFixed(2)}~${alfaxanMlMax.toFixed(2)} mL</span></div><div>프로포폴: <span class="font-bold">${propofolMlMin.toFixed(2)}~${propofolMlMax.toFixed(2)} mL</span><span class="text-xs text-gray-600 block">(2-6 mg/kg)</span></div>${isChill ? '<span class="text-xs text-red-600 font-bold">※ Chill 50% 감량</span>' : ''}`;
    
    const fluidRates = { normal: { pre: "2.0 - 3.0", intra: "3.0 - 5.0", post: "즉시 중단", intra_calc_base: 5.0 }, cardiac: { pre: "1.0 - 1.5", intra: "1.0 - 2.0", post: "< 1.0 또는 중단", intra_calc_base: 2.0 }, renal: { pre: "2.0 - 3.0", intra: "2.0 - 4.0", post: "2.0 - 3.0", intra_calc_base: 4.0 }, liver: { pre: "2.0 - 3.0", intra: "2.0 - 4.0", post: "2.0 - 3.0", intra_calc_base: 4.0 } };
    let patientTypeStr = "정상 환자"; let currentRates;
    if (isCardiac) { currentRates = fluidRates.cardiac; patientTypeStr = "심장 질환"; } else if (isKidney) { currentRates = fluidRates.renal; patientTypeStr = "신장 질환"; } else if (isLiver) { currentRates = fluidRates.liver; patientTypeStr = "간 질환"; } else { currentRates = fluidRates.normal; }
    const correctionFactor = 0.7;
    const generateStageHtml = (label, rateStr, weight, intraBaseRate = null) => { let settingText, targetText; if (rateStr.includes('중단') || rateStr.includes('<')) { settingText = rateStr; targetText = rateStr; } else if (intraBaseRate !== null) { const targetValue = (intraBaseRate * weight).toFixed(1); const settingValue = (targetValue / correctionFactor).toFixed(1); settingText = `${settingValue} mL/hr (시작점)`; targetText = `${targetValue} mL/hr`; } else if (rateStr.includes('-')) { const [low, high] = rateStr.split(' - ').map(parseFloat); const targetLow = (low * weight).toFixed(1); const targetHigh = (high * weight).toFixed(1); const settingLow = (targetLow / correctionFactor).toFixed(1); const settingHigh = (targetHigh / correctionFactor).toFixed(1); settingText = `${settingLow}~${settingHigh} mL/hr`; targetText = `${targetLow}~${targetHigh} mL/hr`; } else { const rate = parseFloat(rateStr); const targetValue = (rate * weight).toFixed(1); const settingValue = (targetValue / correctionFactor).toFixed(1); settingText = `${settingValue} mL/hr`; targetText = `${targetValue} mL/hr`; } return `<div class="mb-2"><div class="text-sm font-bold">${label}</div><div class="font-bold text-lg text-red-600">${settingText}</div><div class="text-xs text-gray-600">(목표: ${targetText})</div></div>`; };
    document.getElementById('fluid_result').innerHTML = `${generateStageHtml('마취 전', currentRates.pre, weight)}${generateStageHtml('마취 중', currentRates.intra, weight, currentRates.intra_calc_base)}${generateStageHtml('마취 후', currentRates.post, weight)}<div class="text-xs text-center text-gray-500 mt-2 border-t pt-1">(${patientTypeStr} / 보정계수 ${correctionFactor} 적용)</div>`;
    
    document.getElementById('chill_protocol_info_card').style.display = isChill ? 'block' : 'none';
    if (isChill) {
        document.getElementById('chill_protocol_content').innerHTML = `<div class="p-4 border rounded-lg bg-gray-50 space-y-3"><div><h4 class="font-bold text-gray-800">1. 사전 처방</h4><p><strong>가바펜틴 100mg 캡슐</strong>을 처방하여, 보호자가 병원 방문 1~2시간 전 가정에서 경구 투여하도록 안내합니다.</p></div><div><h4 class="font-bold text-gray-800">2. 원내 프로토콜</h4><p>가바펜틴을 복용한 환자는 <strong class="text-red-600">마취 전 투약 및 도입마취 용량이 자동으로 50% 감량</strong>됩니다.</p></div></div>`;
    }

    const sitesSelect = document.getElementById('cat_block_sites'); const sites = sitesSelect ? parseInt(sitesSelect.value) || 4 : 4; const total_vol_needed = Math.min(0.3, Math.max(0.1, 0.08 * weight)) * sites; const final_total_ml = Math.min((1.0 * weight / 5 * 1.25), total_vol_needed); document.getElementById('nerve_block_result_cat').innerHTML = `<div class="flex items-center gap-4 mb-4"><label for="cat_block_sites" class="font-semibold text-gray-700">마취 부위 수:</label><select id="cat_block_sites" class="select-field" onchange="calculateAll()"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4" selected>4</option></select></div><div class="p-2 border rounded-lg bg-gray-50"><h4 class="font-semibold text-gray-800">총 준비 용량 (${sites}군데)</h4><p class="text-xs text-red-600 font-bold">부피바케인 총량 1.0mg/kg 초과 금지!</p><p><span class="result-value">${(final_total_ml*0.8).toFixed(2)}mL</span> (0.5% 부피) + <span class="result-value">${(final_total_ml*0.2).toFixed(2)}mL</span> (2% 리도)</p></div>`; if (document.getElementById('cat_block_sites')) document.getElementById('cat_block_sites').value = sites;
    const cri_rate_min_low = weight * 0.12; const cri_rate_min_high = weight * 0.18; const cri_rate_std = weight * 0.3; const cri_rate_max = weight * 0.6; document.getElementById('ketamine_cri_result_cat').innerHTML = `<div class="p-4 border rounded-lg bg-gray-50 space-y-3"><h4 class="font-semibold text-gray-800 text-center">CRI 펌프 속도 설정</h4><p class="text-xs text-center text-gray-600">※ 희석: 케타민(50주) 0.6mL + N/S 29.4mL</p><div class="space-y-2 text-sm"><div class="grid grid-cols-2 items-center p-2 bg-blue-100 rounded-lg"><div class="font-semibold text-blue-800">최소 (2-3 mcg/kg/min)</div><div class="font-bold text-blue-700 text-right text-base">${cri_rate_min_low.toFixed(2)} ~ ${cri_rate_min_high.toFixed(2)} mL/hr</div></div><div class="grid grid-cols-2 items-center p-2 bg-green-100 rounded-lg"><div class="font-semibold text-green-800">표준 (5 mcg/kg/min)</div><div class="font-bold text-green-700 text-right text-base">${cri_rate_std.toFixed(2)} mL/hr</div></div><div class="grid grid-cols-2 items-center p-2 bg-orange-100 rounded-lg"><div class="font-semibold text-orange-800">최대 (10 mcg/kg/min)</div><div class="font-bold text-orange-700 text-right text-base">${cri_rate_max.toFixed(2)} mL/hr</div></div></div><div class="text-xs text-gray-700 border-t border-gray-200 pt-2 mt-2 space-y-1"><p><strong class="text-red-500">HCM 환자:</strong> 심박수 증가 효과/사용에 신중</p><p><strong class="text-red-500">CKD 환자:</strong> 최소 유효 속도(2-3 mcg/kg/min)로 시작하는 것을 고려</p></div></div>`;
    document.getElementById('workflow_steps_cat').innerHTML = `<div class="step-card p-4"><h3 class="font-bold text-lg text-indigo-800">Step 1: 내원 및 안정화</h3><p class="text-sm text-gray-700">IV 장착 후, 수액을 연결하고 입원장 내에서 산소를 공급하며 환자를 안정시킵니다. 필요 시 노스판 패치를 미리 부착합니다.</p></div><div class="step-card p-4"><h3 class="font-bold text-lg text-indigo-800">Step 2: 마취 전 투약</h3><p class="text-sm text-gray-700">산소를 공급하며, 준비된 부토르파놀+미다졸람을 2분에 걸쳐 천천히 IV합니다.</p></div><div class="warning-card p-4"><h3 class="font-bold text-lg text-orange-800">Step 3: 도입마취 및 LK 부하</h3><p class="text-sm text-gray-700">준비된 도입마취제를 효과를 봐가며 주사하여 삽관 후, LK 부하 용량을 1분에 걸쳐 천천히 IV합니다.</p></div><div class="step-card p-4"><h3 class="font-bold text-lg text-indigo-800">Step 4: 마취 유지</h3><p class="text-sm text-gray-700">호흡마취 및 케타민 CRI 펌프를 작동시키고, 모든 발치/수술 부위에 국소마취를 적용합니다.</p></div>`;
}

function populateEmergencyTab(weight) {
    const norepiRate = weight * 0.6;
    const norepiRateMax = weight * 12;
    document.getElementById('hypotension_protocol_cat').innerHTML = `<h3 class="font-bold text-lg text-red-800 mb-2">저혈압 대처 프로토콜</h3><div class="space-y-3 text-sm text-left"><div><h4 class="font-semibold text-gray-800 mb-1">1. 저혈압 판단 기준</h4><ul class="list-disc list-inside space-y-1 pl-2 text-xs"><li><strong>핵심 지표:</strong> 평균 동맥압(MAP) &lt; 60 mmHg</li><li><strong>보조 지표:</strong> 수축기 혈압(SBP) &lt; 90 mmHg</li><li><strong>시간 기준:</strong> 마취제 감량 후 3-5분 이상 지속 시 약물 개입</li></ul></div><div><h4 class="font-semibold text-gray-800 mb-1">2. 단계별 대응 프로토콜</h4><ol class="list-decimal list-inside space-y-1 pl-2 text-xs"><li><strong>즉각 조치:</strong> Isoflurane 농도 0.2~0.5% 즉시 감량</li><li><strong>원인 평가 (1-3분):</strong> 혈압 회복 관찰, 다른 원인 확인</li><li><strong>약물 개입:</strong> 저혈압 지속 시 아래 NE CRI 시작</li></ol></div><div class="p-3 rounded-lg bg-red-100 border border-red-300 mt-2"><h4 class="font-bold text-md text-center text-red-800 mb-2">고양이 NE CRI 프로토콜</h4><p class="text-center font-bold text-red-600 text-base mb-3 p-2 bg-white rounded-md">🚨 수액 볼루스 절대 금기! 승압제 사용!</p><div class="bg-white p-2 rounded-lg mb-3"><h5 class="font-semibold text-center text-sm">펌프 설정 간편 계산식</h5><p class="text-center font-bold text-red-700 text-2xl">${norepiRate.toFixed(2)} mL/hr</p><p class="text-xs text-center font-semibold">(환자 체중 × 0.6)</p></div><div class="text-xs space-y-1"><p><strong>희석 방법:</strong> NE 원액(1mg/mL) 0.3mL + N/S 29.7mL</p><p><strong>시작 용량:</strong> 0.1 mcg/kg/min (위 계산값)</p><p><strong>최대 용량:</strong> 2.0 mcg/kg/min (펌프 설정: ${norepiRateMax.toFixed(2)} mL/hr)</p><p><strong>목표 혈압:</strong> MAP ≥ 65 mmHg, SBP ≥ 90 mmHg</p><p><strong>용량 조절:</strong> 5-10분 간격으로 혈압 확인하며 10-20%씩 증감</p></div></div></div>`;
    document.getElementById('bradycardia_protocol_cat').innerHTML = `<h3 class="font-bold text-lg text-red-800 mt-4">서맥 (Bradycardia)</h3><div class="mt-2 p-2 rounded-lg bg-red-100"><p class="text-center text-red-700 font-bold">아트로핀 금기 (HCM 의심)</p><p class="text-center text-xs text-gray-600">마취 심도 조절 및 원인 교정 우선</p></div>`;
    const epiLowMl = (0.01 * weight) / (concentrations_cat.epinephrine / 10);
    const vasoMl = (0.8 * weight) / concentrations_cat.vasopressin;
    const atropineCpaMl = (0.04 * weight) / concentrations_cat.atropine;
    document.getElementById('cpa_protocol_cat').innerHTML = `<div class="info-box mb-2 text-xs"><p><strong>핵심 개념:</strong> BLS는 '엔진'을 계속 돌려주는 역할이고, ALS는 '엔진을 수리'하는 역할입니다. 고품질의 BLS 없이는 ALS가 성공할 수 없습니다.</p></div><h4 class="font-bold text-md text-gray-800 mt-3">1. BLS (기본소생술)</h4><ul class="list-disc list-inside text-sm space-y-1 mt-1"><li><strong>순환:</strong> 분당 100-120회 속도로 흉곽 1/3 깊이 압박 (2분마다 교대)</li><li><strong>기도확보:</strong> 즉시 기관 삽관</li><li><strong>호흡:</strong> 6초에 1회 인공 환기 (과환기 금지)</li></ul><h4 class="font-bold text-md text-gray-800 mt-3">2. ALS (전문소생술)</h4><div class="mt-2 p-2 rounded-lg bg-red-100 space-y-2"><h5 class="font-semibold text-sm">에피네프린 (Low dose)</h5><p class="text-xs text-center mb-1 font-semibold">희석: 원액 0.1mL + N/S 0.9mL</p><p class="text-center font-bold text-red-700">${epiLowMl.toFixed(2)} mL (희석액) IV</p><hr><h5 class="font-semibold text-sm">바소프레신 (대체 가능)</h5><p class="text-center font-bold text-red-700">${vasoMl.toFixed(2)} mL IV</p><hr><h5 class="font-semibold text-sm">아트로핀 (Vagal arrest 의심 시)</h5><p class="text-center font-bold text-red-700">${atropineCpaMl.toFixed(2)} mL IV</p></div>`;
}
    
// --- 퇴원약 탭 기능 (v4.2 로직 적용) ---
function initializeDischargeTab() {
    const dischargeInputs = document.querySelectorAll('#dischargeTab .med-checkbox, #dischargeTab .days, #dischargeTab .dose');
    dischargeInputs.forEach(input => {
        input.addEventListener('input', calculateDischargeMeds);
        input.addEventListener('change', calculateDischargeMeds);
    });

    // 기본 처방 설정 (v4.2에서 가져온 로직)
    const defaultMeds = {
        '7day': ['clindamycin', 'gabapentin', 'famotidine', 'almagel'],
        '3day': ['vetrocam', 'misoprostol', 'tramadol']
    };

    // 7일짜리 기본 처방 선택
    defaultMeds['7day'].forEach(drugName => {
        const row = document.querySelector(`#dischargeTab tr[data-drug="${drugName}"]`);
        if (row) {
            row.querySelector('.med-checkbox').checked = true;
            row.querySelector('.days').value = 7;
        }
    });

    // 3일짜리 기본 처방 선택
    defaultMeds['3day'].forEach(drugName => {
        const row = document.querySelector(`#dischargeTab tr[data-drug="${drugName}"]`);
        if (row) {
            row.querySelector('.med-checkbox').checked = true;
            row.querySelector('.days').value = 3;
        }
    });
}

function calculateDischargeMeds() {
    isDirty = true;
    const weight = parseFloat(document.getElementById('weight').value);
    if (isNaN(weight) || weight <= 0) {
         document.querySelector('#dischargeTab #summary').innerHTML = '<p>상단의 환자 체중을 입력해주세요.</p>';
         document.querySelectorAll('#dischargeTab .total-amount').forEach(el => el.textContent = '');
         return;
    }

    const summaryData = {};
    document.querySelectorAll('#dischargeTab .med-checkbox:checked').forEach(checkbox => {
        const row = checkbox.closest('tr');
        const drugName = row.cells[1].textContent;
        const days = parseInt(row.querySelector('.days').value);
        const unit = row.dataset.unit;
        let totalAmount = 0;
        let totalAmountText = '';
        let dailyMultiplier = 2;

        if (row.dataset.special === 'vetrocam') {
            dailyMultiplier = 1;
            totalAmount = weight * 0.2 + weight * 0.1 * Math.max(0, days - 1);
            totalAmountText = `${totalAmount.toFixed(1)} ${unit}`;
        } else if (row.dataset.special === 'same') {
            dailyMultiplier = 1;
            totalAmount = (weight / 2.5) * 0.25 * days;
            totalAmountText = `${totalAmount.toFixed(1)} ${unit}`;
        } else if (row.dataset.special === 'paramel') {
             const dose = 0.75;
             totalAmount = weight * dose * dailyMultiplier * days;
             totalAmountText = `${totalAmount.toFixed(1)} ${unit}`;
        } else {
            const dose = parseFloat(row.querySelector('.dose').value);
            const strength = parseFloat(row.dataset.strength);
            if (strength > 0 && !isNaN(dose)) {
                totalAmount = (weight * dose * dailyMultiplier * days) / strength;
                totalAmountText = `${totalAmount.toFixed(1)} ${unit}`;
            } else {
                totalAmountText = "함량 필요";
            }
        }
        row.querySelector('.total-amount').textContent = totalAmountText;
        if (!summaryData[days]) summaryData[days] = [];
        let summaryText = `${drugName.split(' (')[0]} ${totalAmountText}`;
        if (dailyMultiplier === 1) summaryText += ' (1일 1회)';
        const isLiverDanger = row.querySelector('.notes').dataset.liver === 'true' && document.getElementById('statusLiver').checked;
        const isKidneyDanger = row.querySelector('.notes').dataset.kidney === 'true' && document.getElementById('statusKidney').checked;
        summaryData[days].push({ text: summaryText, isDanger: isLiverDanger || isKidneyDanger });
    });
    updateSummaryUI(summaryData);
    updateDischargeWarnings();
}

function updateSummaryUI(summaryData) {
    const summaryContainer = document.querySelector('#dischargeTab #summary');
    summaryContainer.innerHTML = '';
    const sortedDays = Object.keys(summaryData).sort((a, b) => a - b);
    if (sortedDays.length === 0) {
        summaryContainer.innerHTML = '<p>조제할 약물을 선택해주세요.</p>';
        return;
    }
    sortedDays.forEach(day => {
        const box = document.createElement('div');
        box.className = 'summary-box';
        const title = document.createElement('h3');
        title.textContent = `${day}일 처방`;
        box.appendChild(title);
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
    const liverIssue = document.getElementById('statusLiver').checked;
    const kidneyIssue = document.getElementById('statusKidney').checked;
    document.querySelectorAll('#dischargeTab .notes').forEach(noteCell => {
        noteCell.classList.remove('highlight-warning');
        if ((liverIssue && noteCell.dataset.liver === 'true') || (kidneyIssue && noteCell.dataset.kidney === 'true')) {
            noteCell.classList.add('highlight-warning');
        }
    });
}

// --- ET Tube 탭 계산기 ---
const weightSizeGuideCat = [ { weight: 1, size: '2.0' }, { weight: 2, size: '2.5' }, { weight: 3.5, size: '3.0' }, { weight: 4, size: '3.5' }, { weight: 6, size: '4.0' }, { weight: 9, size: '4.5' } ];
const tracheaSizeGuideCat = [ { diameter: 5.13, id: '2.5' }, { diameter: 5.88, id: '3.0' }, { diameter: 6.63, id: '3.5' }, { diameter: 7.50, id: '4.0' }, { diameter: 8.13, id: '4.5' }, { diameter: 8.38, id: '5.0' }, { diameter: 9.13, id: '5.5' }, { diameter: 10.00, id: '6.0' }, { diameter: 11.38, id: '6.5' }, { diameter: 11.63, id: '7.0' }, { diameter: 12.50, id: '7.5' }, { diameter: 13.38, id: '8.0' } ];

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
    let recommendedId = '8.0 이상';
    for (let i = 0; i < tracheaSizeGuideCat.length; i++) { if (diameter <= tracheaSizeGuideCat[i].diameter) { recommendedId = tracheaSizeGuideCat[i].id; break; } }
    resultTextTrachea.textContent = recommendedId;
    resultContainerTrachea.classList.remove('hidden');
}

function saveCatEtTubeSelection() {
    isDirty = true;
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
        const cuffStatus = selectedCatTubeInfo.cuff ? `<span class="text-green-600 font-semibold"><i class="fas fa-check-circle mr-1"></i>확인 완료</span>` : `<span class="text-red-600 font-semibold"><i class="fas fa-times-circle mr-1"></i>미확인</span>`;
        const notesText = selectedCatTubeInfo.notes ? `<p class="text-sm text-gray-600 mt-2"><strong>메모:</strong> ${selectedCatTubeInfo.notes}</p>` : ``;
        displayDiv.innerHTML = `<div class="text-left grid grid-cols-1 sm:grid-cols-2 gap-x-4"><p class="text-lg"><strong>선택된 Tube 사이즈 (ID):</strong> <span class="result-value text-2xl">${selectedCatTubeInfo.size}</span></p><p class="text-lg"><strong>커프(Cuff) 확인:</strong> ${cuffStatus}</p></div>${notesText}`;
    } else {
        displayDiv.innerHTML = `<p class="text-gray-700">ET Tube가 아직 선택되지 않았습니다. 'ET Tube' 탭에서 기록해주세요.</p>`;
    }
}

// --- 공격성 고양이 탭 기능 ---
function switchAggCatTab(tabName) {
    document.getElementById('aggcat-content-previsit').style.display = 'none';
    document.getElementById('aggcat-content-im').style.display = 'none';
    document.getElementById('aggcat-tab-previsit').classList.remove('active');
    document.getElementById('aggcat-tab-im').classList.remove('active');
    document.getElementById('aggcat-content-' + tabName).style.display = 'block';
    document.getElementById('aggcat-tab-' + tabName).classList.add('active');
}

function calculateAggCatProtocol() {
    isDirty = true;
    const weightInput = document.getElementById('aggCatWeight');
    const weight = parseFloat(weightInput.value);
    const mainWeightInput = document.getElementById('weight');
    if (mainWeightInput.value !== weightInput.value) {
        mainWeightInput.value = weightInput.value;
        if (weight > 0) calculateAll();
    }
    if (isNaN(weight) || weight <= 0) {
        document.getElementById('result-gabapentin').innerHTML = '유효한 체중을 입력하세요.';
        document.getElementById('result-combo').innerHTML = '유효한 체중을 입력하세요.';
        document.getElementById('result-im-aggcat').innerHTML = '<tr><td colspan="4" class="text-center">유효한 체중을 입력하세요.</td></tr>';
        return;
    }
    calculateAggCatPreVisit(weight);
    calculateAggCatIM(weight);
}

function calculateAggCatPreVisit(weight) {
    document.getElementById('result-gabapentin').innerHTML = `<p class="text-base mb-1">내원 2-3시간 전 경구 투여</p><p class="text-2xl font-bold text-blue-600">가바펜틴 100-200 mg</p><p class="text-sm text-gray-500">(캡슐 1-2개)</p>`;
    document.getElementById('result-combo').innerHTML = `<div class="space-y-2"><div><p class="text-base mb-1">내원 전날 밤</p><p class="text-xl font-bold text-red-600">가바펜틴 100-200 mg</p><p class="text-sm text-gray-500">(캡슐 1-2개)</p></div><hr><div><p class="text-base mb-1">내원 2-3시간 전</p><p class="text-xl font-bold text-red-600">가바펜틴 100-200 mg</p><p class="text-sm text-gray-500 mb-2">(캡슐 1-2개)</p><p class="text-xl font-bold text-red-600">+ 트라조돈 50 mg</p><p class="text-sm text-gray-500">(50mg 정제 1개)</p></div></div>`;
}

function createAggCatIMRow(drug, goal, doseRange, weight) {
    const [minDose, maxDose] = doseRange;
    const minMg = (minDose * weight).toFixed(2);
    const maxMg = (maxDose * weight).toFixed(2);
    const concentration = concentrations_cat[drug.toLowerCase()];
    const minMl = (minMg / concentration).toFixed(2);
    const maxMl = (maxMg / concentration).toFixed(2);
    return `<tr><td class="font-semibold">${drug} <span class="text-xs text-gray-500">(${concentration}mg/mL)</span></td><td>${goal}</td><td>${minDose.toFixed(1)} - ${maxDose.toFixed(1)} mg/kg</td><td class="font-bold text-indigo-600"><div>${minMg} - ${maxMg} mg</div><div class="text-sm text-gray-700">${minMl} - ${maxMl} mL</div></td></tr>`;
}

function calculateAggCatIM(weight) {
    const resultTbody = document.getElementById('result-im-aggcat');
    let html = createAggCatIMRow('Alfaxalone', '깊은 진정', [2.0, 3.0], weight);
    html += createAggCatIMRow('Butorphanol', '깊은 진정', [0.2, 0.4], weight);
    html += createAggCatIMRow('Midazolam', '깊은 진정', [0.2, 0.3], weight);
    html += `<tr><td colspan="4" class="bg-gray-200 h-1 p-0"></td></tr>`;
    html += createAggCatIMRow('Alfaxalone', '단시간 마취', [3.0, 5.0], weight);
    html += createAggCatIMRow('Butorphanol', '단시간 마취', [0.3, 0.4], weight);
    html += createAggCatIMRow('Midazolam', '단시간 마취', [0.2, 0.3], weight);
    resultTbody.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', initializeAll);
