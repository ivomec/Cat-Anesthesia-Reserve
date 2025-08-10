// --- 전역 변수 및 상수 ---
const concentrations_cat = {
    butorphanol: 10, midazolam: 5, propofol: 10, alfaxalone: 10, ketamine: 50, ketamine_diluted: 10, bupivacaine: 5, lidocaine: 20,
    meloxicam_inj: 2, atropine: 0.5, norepinephrine_raw: 1, epinephrine: 1, vasopressin: 20, meloxicam_oral: 0.5, dexmedetomidine: 0.5
};
const pillStrengths_cat = { gabapentin: 100, amoxicillin_capsule: 250, famotidine: 10 };
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
    
    // ... (populatePrepTab의 나머지 모든 계산 로직)
}

function populateEmergencyTab(weight) {
    const norepiRate = weight * 0.6;
    const norepiRateMax = weight * 12;
    document.getElementById('hypotension_protocol_cat').innerHTML = `<h3 class="font-bold text-lg text-red-800 mb-2">저혈압 대처 프로토콜</h3>...`; // 내용 복원
    document.getElementById('bradycardia_protocol_cat').innerHTML = `<h3 class="font-bold text-lg text-red-800 mt-4">서맥 (Bradycardia)</h3>...`; // 내용 복원
    const epiLowMl = (0.01 * weight) / (concentrations_cat.epinephrine / 10);
    const vasoMl = (0.8 * weight) / concentrations_cat.vasopressin;
    const atropineCpaMl = (0.04 * weight) / concentrations_cat.atropine;
    document.getElementById('cpa_protocol_cat').innerHTML = `...<p>${epiLowMl.toFixed(2)} mL (희석액) IV</p>...<p>${vasoMl.toFixed(2)} mL IV</p>...<p>${atropineCpaMl.toFixed(2)} mL IV</p>...`; // 내용 및 계산 결과 복원
}
    
// --- 퇴원약 탭 기능 (복원된 전체 코드) ---
function initializeDischargeTab() {
    const dischargeInputs = document.querySelectorAll('#dischargeTab .med-checkbox, #dischargeTab .days, #dischargeTab .dose');
    dischargeInputs.forEach(input => {
        input.addEventListener('input', calculateDischargeMeds);
        input.addEventListener('change', calculateDischargeMeds);
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
            const day1Dose = weight * 0.2;
            const otherDaysDose = weight * 0.1 * (days > 1 ? days - 1 : 0);
            totalAmount = day1Dose + otherDaysDose;
            totalAmountText = `${totalAmount.toFixed(1)} ${unit}`;
        } else if (row.dataset.special === 'same') {
            dailyMultiplier = 1;
            totalAmount = (weight / 2.5) * 0.25 * days;
            totalAmountText = `${totalAmount.toFixed(1)} ${unit}`;
        } else if (row.dataset.special === 'paramel') {
             dailyMultiplier = 2;
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
function calculateWeightSize() { /*...*/ }
function calculateTracheaSize() { /*...*/ }
function saveCatEtTubeSelection() { /*...*/ }
function updateCatTubeDisplay() { /*...*/ }

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
