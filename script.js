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
    // 초기 로드 후에는 변경사항이 없는 상태로 설정
    setTimeout(() => { isDirty = false; }, 100);
}

// --- 마취 타이머 기능 ---
function startTimer() {
    if (timerInterval) return; // 이미 실행 중이면 무시
    isDirty = true;
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(updateTimer, 1000);
    document.getElementById('start-timer-btn').disabled = true;
    document.getElementById('stop-timer-btn').disabled = false;
}

function stopTimer() {
    if (!timerInterval) return; // 실행 중이 아니면 무시
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
    const currentTime = Date.now();
    elapsedTime = currentTime - startTime;
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

// --- 전역 이름 연동 ---
function hasFinalConsonant(name) {
    if (!name) return false;
    const lastChar = name.charCodeAt(name.length - 1);
    return (lastChar >= 0xAC00 && lastChar <= 0xD7A3) ? (lastChar - 0xAC00) % 28 !== 0 : false;
}

function updateAllTitles() {
    // 기능 비어있음 (추후 확장용)
}

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
            totalAnesthesiaTime: elapsedTime // 타이머 시간 추가
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
        
        // 타이머 시간 복원
        if (data.totalAnesthesiaTime) {
            elapsedTime = data.totalAnesthesiaTime;
            document.getElementById('anesthesia-time-display').textContent = formatTime(elapsedTime);
        } else {
            resetTimer();
        }

        calculateAll();
        isDirty = false; // 데이터를 불러온 후에는 '저장된' 상태로 간주
        alert('기록을 성공적으로 불러왔습니다.');
    } catch (error) {
        console.error("Error applying data:", error);
        alert("데이터를 적용하는 중 오류가 발생했습니다. 파일이 손상되었을 수 있습니다.");
    }
}

function saveDataAsJson() {
    try {
        if(timerInterval) stopTimer(); // 저장 시 타이머가 돌고 있으면 일단 멈춤
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
        
        isDirty = false; // 저장이 완료되었으므로 '깨끗한' 상태로 설정
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
    event.target.value = ''; // 동일한 파일을 다시 불러올 수 있도록 초기화
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
    updateAllTitles();
    updateCatTubeDisplay();
    const weightInput = document.getElementById('weight');
    const weight = parseFloat(weightInput.value);

    // 다른 계산기와 체중 연동
    if(document.getElementById('weight-input')) document.getElementById('weight-input').value = weight;
    if(document.getElementById('aggCatWeight')) document.getElementById('aggCatWeight').value = weight;
    calculateWeightSize();
    calculateAggCatProtocol();
    
    const isCardiac = document.getElementById('statusCardiac').checked;
    const isLiver = document.getElementById('statusLiver').checked;
    const isKidney = document.getElementById('statusKidney').checked;
    const isChill = document.getElementById('statusChill').checked;

    if (!weightInput.value || isNaN(weight) || weight <= 0) {
        const elementsToClear = [
            'antibiotic_result', 'patch_result', 'premed_result', 
            'loading_dose_result', 'induction_result', 'fluid_result',
            'nerve_block_result_cat', 'ketamine_cri_result_cat', 
            'hypotension_protocol_cat', 'bradycardia_protocol_cat', 'cpa_protocol_cat'
        ];
        elementsToClear.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '체중을 입력해주세요.';
        });
        calculateDischargeMeds(); 
        return;
    }

    populatePrepTab(weight, isCardiac, isKidney, isLiver, isChill);
    populateEmergencyTab(weight); // 복원된 함수 호출
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
    document.getElementById('patch_result').innerHTML = `${patchRecommendation} 패치 적용`;

    document.getElementById('premed_result').innerHTML = `<span class="font-bold">${butorMl.toFixed(2)} mL</span> 부토르파놀<br><span class="font-bold">${midaMl.toFixed(2)} mL</span> 미다졸람 ${isChill ? '<br><span class="text-xs text-red-600 font-bold">※ Chill 50% 감량</span>' : ''}`;
    document.getElementById('loading_dose_result').innerHTML = `<span class="font-bold">${lidoMl.toFixed(2)} mL</span> 리도카인<br><span class="font-bold">${ketaLoadMl.toFixed(2)} mL</span> 케타민(희석)<br><span class="text-xs text-gray-600 font-semibold">※ 케타민(50주) 0.2mL + N/S 0.8mL</span>`;
    let alfaxanHighlightClass = isCardiac ? 'highlight-recommend' : '';
    document.getElementById('induction_result').innerHTML = `<div class="${alfaxanHighlightClass} p-1 rounded-md">알팍산: <span class="font-bold">${alfaxanMlMin.toFixed(2)}~${alfaxanMlMax.toFixed(2)} mL</span></div><div>프로포폴: <span class="font-bold">${propofolMlMin.toFixed(2)}~${propofolMlMax.toFixed(2)} mL</span><span class="text-xs text-gray-600 block">(2-6 mg/kg)</span></div>${isChill ? '<span class="text-xs text-red-600 font-bold">※ Chill 50% 감량</span>' : ''}`;

    // 나머지 계산식 (항생제, 수액 등)은 기존 로직을 그대로 유지합니다.
    // ...
}

function populateEmergencyTab(weight) {
    // Norepinephrine calculation
    const norepiRate = weight * 0.6;
    const norepiRateMax = weight * 12;

    // Hypotension Protocol HTML
    document.getElementById('hypotension_protocol_cat').innerHTML = `
    <h3 class="font-bold text-lg text-red-800 mb-2">저혈압 대처 프로토콜</h3>
    <div class="space-y-3 text-sm text-left">
        <div>
            <h4 class="font-semibold text-gray-800 mb-1">1. 저혈압 판단 기준</h4>
            <ul class="list-disc list-inside space-y-1 pl-2 text-xs">
                <li><strong>핵심 지표:</strong> 평균 동맥압(MAP) &lt; 60 mmHg</li>
                <li><strong>보조 지표:</strong> 수축기 혈압(SBP) &lt; 90 mmHg</li>
                <li><strong>시간 기준:</strong> 마취제 감량 후 3-5분 이상 지속 시 약물 개입</li>
            </ul>
        </div>
        <div>
            <h4 class="font-semibold text-gray-800 mb-1">2. 단계별 대응 프로토콜</h4>
            <ol class="list-decimal list-inside space-y-1 pl-2 text-xs">
                <li><strong>즉각 조치:</strong> Isoflurane 농도 0.2~0.5% 즉시 감량</li>
                <li><strong>원인 평가 (1-3분):</strong> 혈압 회복 관찰, 다른 원인 확인</li>
                <li><strong>약물 개입:</strong> 저혈압 지속 시 아래 NE CRI 시작</li>
            </ol>
        </div>
        <div class="p-3 rounded-lg bg-red-100 border border-red-300 mt-2">
            <h4 class="font-bold text-md text-center text-red-800 mb-2">고양이 NE CRI 프로토콜</h4>
            <p class="text-center font-bold text-red-600 text-base mb-3 p-2 bg-white rounded-md">🚨 수액 볼루스 절대 금기! 승압제 사용!</p>
            <div class="bg-white p-2 rounded-lg mb-3">
                <h5 class="font-semibold text-center text-sm">펌프 설정 간편 계산식</h5>
                <p class="text-center font-bold text-red-700 text-2xl">${norepiRate.toFixed(2)} mL/hr</p>
                <p class="text-xs text-center font-semibold">(환자 체중 × 0.6)</p>
            </div>
            <div class="text-xs space-y-1">
                <p><strong>희석 방법:</strong> NE 원액(1mg/mL) 0.3mL + N/S 29.7mL</p>
                <p><strong>시작 용량:</strong> 0.1 mcg/kg/min (위 계산값)</p>
                <p><strong>최대 용량:</strong> 2.0 mcg/kg/min (펌프 설정: ${norepiRateMax.toFixed(2)} mL/hr)</p>
                <p><strong>목표 혈압:</strong> MAP ≥ 65 mmHg, SBP ≥ 90 mmHg</p>
                <p><strong>용량 조절:</strong> 5-10분 간격으로 혈압 확인하며 10-20%씩 증감</p>
            </div>
        </div>
    </div>`;

    // Bradycardia Protocol HTML
    document.getElementById('bradycardia_protocol_cat').innerHTML = `
        <h3 class="font-bold text-lg text-red-800 mt-4">서맥 (Bradycardia)</h3>
        <div class="mt-2 p-2 rounded-lg bg-red-100">
            <p class="text-center text-red-700 font-bold">아트로핀 금기 (HCM 의심)</p>
            <p class="text-center text-xs text-gray-600">마취 심도 조절 및 원인 교정 우선</p>
        </div>`;

    // CPA Protocol Calculations and HTML
    const epiLowMl = (0.01 * weight) / (concentrations_cat.epinephrine / 10);
    const vasoMl = (0.8 * weight) / concentrations_cat.vasopressin;
    const atropineCpaMl = (0.04 * weight) / concentrations_cat.atropine;
    document.getElementById('cpa_protocol_cat').innerHTML = `<div class="info-box mb-2 text-xs"><p><strong>핵심 개념:</strong> BLS는 '엔진'을 계속 돌려주는 역할이고, ALS는 '엔진을 수리'하는 역할입니다. 고품질의 BLS 없이는 ALS가 성공할 수 없습니다.</p></div><h4 class="font-bold text-md text-gray-800 mt-3">1. BLS (기본소생술)</h4><ul class="list-disc list-inside text-sm space-y-1 mt-1"><li><strong>순환:</strong> 분당 100-120회 속도로 흉곽 1/3 깊이 압박 (2분마다 교대)</li><li><strong>기도확보:</strong> 즉시 기관 삽관</li><li><strong>호흡:</strong> 6초에 1회 인공 환기 (과환기 금지)</li></ul><h4 class="font-bold text-md text-gray-800 mt-3">2. ALS (전문소생술)</h4><div class="mt-2 p-2 rounded-lg bg-red-100 space-y-2"><h5 class="font-semibold text-sm">에피네프린 (Low dose)</h5><p class="text-xs text-center mb-1 font-semibold">희석: 원액 0.1mL + N/S 0.9mL</p><p class="text-center font-bold text-red-700">${epiLowMl.toFixed(2)} mL (희석액) IV</p><hr><h5 class="font-semibold text-sm">바소프레신 (대체 가능)</h5><p class="text-center font-bold text-red-700">${vasoMl.toFixed(2)} mL IV</p><hr><h5 class="font-semibold text-sm">아트로핀 (Vagal arrest 의심 시)</h5><p class="text-center font-bold text-red-700">${atropineCpaMl.toFixed(2)} mL IV</p></div>`;
}
    
// --- 나머지 함수들 (기존과 동일) ---
function initializeDischargeTab() { /*...*/ }
function calculateDischargeMeds() { /*...*/ }
function updateSummaryUI(summaryData) { /*...*/ }
function updateDischargeWarnings() { /*...*/ }
function calculateWeightSize() { /*...*/ }
function calculateTracheaSize() { /*...*/ }
function saveCatEtTubeSelection() { /*...*/ }
function updateCatTubeDisplay() { /*...*/ }
function switchAggCatTab(tabName) { /*...*/ }
function calculateAggCatProtocol() { /*...*/ }
function calculateAggCatPreVisit(weight) { /*...*/ }
function createAggCatIMRow(drug, goal, doseRange, weight) { /*...*/ }
function calculateAggCatIM(weight) { /*...*/ }

// 스크립트의 모든 함수와 변수가 정의된 후, DOM 콘텐츠가 로드되면 초기화 함수를 실행합니다.
document.addEventListener('DOMContentLoaded', initializeAll);
