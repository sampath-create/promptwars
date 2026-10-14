/**
 * MediBridge AI - Frontend Controller
 * Handles image selection, patient context tags, API transmission, audio TTS, and care plan rendering.
 */

// Application State
const state = {
  selectedFile: null,
  tags: {
    allergies: [],
    medicines: [],
    conditions: []
  },
  activeTab: 'schedule',
  isDemoMode: false,
  currentPlanResponse: null,
  speechSynth: window.speechSynthesis,
  currentUtterance: null,
  apiBaseUrl: ''
};

// Preset Test Cases
const PRESETS = {
  diabetes: {
    age: 72,
    language: 'Hindi',
    allergies: ['Sulfa'],
    medicines: ['Metformin', 'Amlodipine'],
    conditions: ['Type 2 Diabetes', 'Hypertension'],
    pregnant: false,
    child: false,
    sampleTitle: 'Polypharmacy & Diabetes (Elderly)',
    mockData: {
      extraction_confidence: "high",
      unreadable_or_missing_fields: [],
      patient_friendly_summary: "यह नुस्खा आपके रक्त शर्करा (ब्लड शुगर) और रक्तचाप (ब्लड प्रेशर) को नियंत्रित करने के लिए है। मेटफॉर्मिन और ग्लिमेपिराइड भोजन के साथ लें। एम्लोडिपिन सुबह के समय लें। चक्कर आने या पसीना आने पर तुरंत मीठा खाएं और डॉक्टर से संपर्क करें।",
      medications: [
        {
          medicine_name: "Metformin ER",
          strength: "500 mg",
          form: "tablet",
          dose: "1 tablet",
          frequency: "Twice daily",
          timing: "Morning and Evening with meals",
          duration: "30 days",
          food_instruction: "with_food",
          purpose_if_stated: "Type 2 Diabetes",
          plain_language_purpose: "Helps lower blood sugar levels safely after eating.",
          important_warnings: ["Do not skip meals while taking this medicine.", "Avoid excessive alcohol consumption."],
          source_text_from_image: "Tab Metformin ER 500mg - 1 tab BD pc"
        },
        {
          medicine_name: "Glimepiride",
          strength: "2 mg",
          form: "tablet",
          dose: "1 tablet",
          frequency: "Once daily",
          timing: "Morning with breakfast",
          duration: "30 days",
          food_instruction: "with_food",
          purpose_if_stated: "Diabetes",
          plain_language_purpose: "Stimulates insulin release to keep morning sugars balanced.",
          important_warnings: ["Watch for signs of low blood sugar (shakiness, cold sweat, hunger)."],
          source_text_from_image: "Tab Glimepiride 2mg - 1 OD morning BF"
        },
        {
          medicine_name: "Amlodipine",
          strength: "5 mg",
          form: "tablet",
          dose: "1 tablet",
          frequency: "Once daily",
          timing: "Morning at 08:00 AM",
          duration: "30 days",
          food_instruction: "after_food",
          purpose_if_stated: "Hypertension",
          plain_language_purpose: "Relaxes blood vessels to bring high blood pressure down.",
          important_warnings: ["May cause mild ankle swelling; notify doctor if bothersome."],
          source_text_from_image: "Tab Amlodipine 5mg - 1 OD morning"
        }
      ],
      daily_schedule: [
        {
          time: "08:00",
          medicines: ["Metformin ER 500mg", "Glimepiride 2mg", "Amlodipine 5mg"],
          instruction: "Take with morning breakfast and a glass of water.",
          reminder_message: "Breakfast medicines: Keep blood sugar and BP smooth today."
        },
        {
          time: "20:00",
          medicines: ["Metformin ER 500mg"],
          instruction: "Take right after dinner.",
          reminder_message: "Evening dose: Controls overnight sugar spikes."
        }
      ],
      missed_dose_guidance: "Take as soon as remembered with food. If close to the next scheduled dose, skip the missed dose. Never take two doses together.",
      potential_safety_flags: [
        {
          severity: "low",
          issue: "'metformin' is already in current medicines.",
          recommended_action: "Confirm with prescriber whether this is a continuation or dose adjustment."
        },
        {
          severity: "low",
          issue: "Elderly polypharmacy risk (age 72).",
          recommended_action: "Ensure caregiver or pill organizer is in place to prevent accidental double-dosing."
        }
      ],
      caregiver_alert_needed: false,
      caregiver_alert_message: "",
      follow_up_questions_for_patient: [
        "Are you taking any herbal supplements or painkillers like ibuprofen?",
        "When was your last HbA1c blood test taken?"
      ],
      medical_disclaimer: "MediBridge AI gives medication reminders and simplified information. It does not replace advice from a doctor, pharmacist, or emergency medical service."
    }
  },
  allergy: {
    age: 45,
    language: 'English',
    allergies: ['Penicillin', 'Amoxicillin'],
    medicines: ['Paracetamol'],
    conditions: ['Bacterial Sinusitis'],
    pregnant: false,
    child: false,
    sampleTitle: 'Emergency: Penicillin Allergy Clash',
    mockData: {
      extraction_confidence: "high",
      unreadable_or_missing_fields: [],
      patient_friendly_summary: "URGENT SAFETY ALERT: This prescription contains Amoxicillin, which belongs to the Penicillin antibiotic family. Your records indicate a documented Penicillin allergy. DO NOT take this medication until contacting your prescriber.",
      medications: [
        {
          medicine_name: "Amoxicillin / Clavulanate",
          strength: "625 mg",
          form: "tablet",
          dose: "1 tablet",
          frequency: "Twice daily",
          timing: "Morning and Night",
          duration: "7 days",
          food_instruction: "after_food",
          purpose_if_stated: "Sinus Infection",
          plain_language_purpose: "Broad-spectrum penicillin-type antibiotic to fight bacterial infection.",
          important_warnings: ["CONTRAINDICATED: Patient has stated Penicillin allergy."],
          source_text_from_image: "Tab Augmentin 625 (Amox-Clav) 1 BD x 7d"
        }
      ],
      daily_schedule: [
        {
          time: "09:00",
          medicines: ["Amoxicillin / Clavulanate 625mg"],
          instruction: "HOLD MEDICATION - Contact doctor immediately.",
          reminder_message: "Do not swallow this pill until doctor confirms safe alternative."
        }
      ],
      missed_dose_guidance: "Do not start this medicine until confirmed by your prescribing physician or hospital pharmacist.",
      potential_safety_flags: [
        {
          severity: "emergency",
          issue: "Listed allergy 'penicillin' / 'amoxicillin' matches prescribed Amoxicillin.",
          recommended_action: "Do NOT take. Contact doctor or pharmacist immediately for an allergy-safe alternative (e.g. macrolide or fluoroquinolone)."
        }
      ],
      caregiver_alert_needed: true,
      caregiver_alert_message: "URGENT: Patient was prescribed an antibiotic that conflicts with their Penicillin allergy. Please intervene before purchase or ingestion.",
      follow_up_questions_for_patient: [
        "What type of reaction do you experience with Penicillin (hives, difficulty breathing, rash)?",
        "Has the doctor been informed about your allergy?"
      ],
      medical_disclaimer: "MediBridge AI gives medication reminders and simplified information. It does not replace advice from a doctor, pharmacist, or emergency medical service."
    }
  },
  pediatric: {
    age: 7,
    language: 'English',
    allergies: [],
    medicines: [],
    conditions: ['Acute Bronchitis'],
    pregnant: false,
    child: true,
    sampleTitle: 'Pediatric Care Plan & Safety Review',
    mockData: {
      extraction_confidence: "high",
      unreadable_or_missing_fields: [],
      patient_friendly_summary: "This care plan is for a child. Liquid medicines must always be measured using the marked syringe or measuring cup provided with the bottle, never an ordinary kitchen spoon. Ensure child drinks plenty of fluids.",
      medications: [
        {
          medicine_name: "Azithromycin Oral Suspension",
          strength: "200 mg / 5 mL",
          form: "syrup",
          dose: "5 mL",
          frequency: "Once daily",
          timing: "1 hour before lunch",
          duration: "3 days",
          food_instruction: "empty_stomach",
          purpose_if_stated: "Chest infection",
          plain_language_purpose: "Antibiotic syrup to clear up the chest cough.",
          important_warnings: ["Shake well before each dose.", "Finish all 3 days even if child feels better."],
          source_text_from_image: "Syp Azithral 200mg/5ml - 5ml OD x 3d"
        },
        {
          medicine_name: "Salbutamol Syrup",
          strength: "2 mg / 5 mL",
          form: "syrup",
          dose: "2.5 mL",
          frequency: "Every 8 hours as needed",
          timing: "When wheezing or tight chest",
          duration: "5 days",
          food_instruction: "no_restriction",
          purpose_if_stated: "Wheezing relief",
          plain_language_purpose: "Opens up airways to make breathing easier.",
          important_warnings: ["May cause mild shakiness or rapid heartbeat temporarily."],
          source_text_from_image: "Syp Asthalin 2.5ml SOS wheezing"
        }
      ],
      daily_schedule: [
        {
          time: "11:30",
          medicines: ["Azithromycin 5 mL"],
          instruction: "Give 1 hour before meal using measuring dropper.",
          reminder_message: "Antibiotic time: Shake bottle well."
        },
        {
          time: "15:00",
          medicines: ["Salbutamol 2.5 mL (if needed)"],
          instruction: "Give only if child is wheezing or coughing persistently.",
          reminder_message: "Check breathing sounds before giving."
        }
      ],
      missed_dose_guidance: "Give as soon as remembered. Do not double the dose.",
      potential_safety_flags: [
        {
          severity: "medium",
          issue: "Paediatric patient (Age 7).",
          recommended_action: "Verify dosage matches child's current body weight with the pharmacist before first dose."
        }
      ],
      caregiver_alert_needed: false,
      caregiver_alert_message: "",
      follow_up_questions_for_patient: [
        "What is the child's exact weight in kg?",
        "Has the child had any vomiting or diarrhea since falling ill?"
      ],
      medical_disclaimer: "MediBridge AI gives medication reminders and simplified information. It does not replace advice from a doctor, pharmacist, or emergency medical service."
    }
  }
};

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const dropZonePrompt = document.getElementById('dropZonePrompt');
const previewWrapper = document.getElementById('previewWrapper');
const imagePreview = document.getElementById('imagePreview');
const previewMeta = document.getElementById('previewMeta');
const removeImageBtn = document.getElementById('removeImageBtn');

const carePlanForm = document.getElementById('carePlanForm');
const submitBtn = document.getElementById('submitBtn');
const scannerSection = document.getElementById('scannerSection');
const loadingSection = document.getElementById('loadingSection');
const resultsSection = document.getElementById('resultsSection');
const backToScanBtn = document.getElementById('backToScanBtn');

// Status & Config
const apiStatusBadge = document.getElementById('apiStatusBadge');
const apiStatusText = document.getElementById('apiStatusText');
const demoModeToggle = document.getElementById('demoModeToggle');
const demoModeLabel = document.getElementById('demoModeLabel');
const configModalBtn = document.getElementById('configModalBtn');
const configModal = document.getElementById('configModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const apiKeyInput = document.getElementById('apiKeyInput');
const apiUrlInput = document.getElementById('apiUrlInput');
const mockModeCheckbox = document.getElementById('mockModeCheckbox');

// Audio & Export
const ttsPlayBtn = document.getElementById('ttsPlayBtn');
const ttsStopBtn = document.getElementById('ttsStopBtn');
const ttsBtnLabel = document.getElementById('ttsBtnLabel');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const copyJsonBtn = document.getElementById('copyJsonBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  setupTagInputs();
  checkBackendHealth();

  // Load saved settings
  const savedKey = localStorage.getItem('medibridge_api_key');
  if (savedKey) apiKeyInput.value = savedKey;

  const savedUrl = localStorage.getItem('medibridge_api_url');
  if (savedUrl) apiUrlInput.value = savedUrl;

  const savedDemo = localStorage.getItem('medibridge_demo_mode');
  if (savedDemo === 'true') {
    enableDemoMode(true);
  }
});

// Event Listeners
function setupEventListeners() {
  // Drop zone events
  ['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  });

  removeImageBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearSelectedFile();
  });

  // Preset chips
  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const presetKey = chip.getAttribute('data-preset');
      loadPreset(presetKey);
    });
  });

  // Submit Form
  carePlanForm.addEventListener('submit', handleFormSubmit);

  // Back to scan
  backToScanBtn.addEventListener('click', () => {
    resultsSection.classList.add('hidden');
    scannerSection.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    stopTTS();
  });

  // Tabs
  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      switchTab(target);
    });
  });

  // Modal
  configModalBtn.addEventListener('click', () => configModal.classList.remove('hidden'));
  closeModalBtn.addEventListener('click', () => configModal.classList.add('hidden'));
  saveConfigBtn.addEventListener('click', saveConfiguration);

  // Demo toggle
  demoModeToggle.addEventListener('click', () => {
    enableDemoMode(!state.isDemoMode);
  });

  // TTS Controls
  ttsPlayBtn.addEventListener('click', toggleTTS);
  ttsStopBtn.addEventListener('click', stopTTS);

  // Export & Copy
  exportPdfBtn.addEventListener('click', () => window.print());
  copyJsonBtn.addEventListener('click', copyRawJson);
}

// Backend Health Check
async function checkBackendHealth() {
  const base = apiUrlInput.value.trim() || '';
  const statusDot = apiStatusBadge.querySelector('.status-dot');

  try {
    const res = await fetch(`${base}/health`);
    if (res.ok) {
      statusDot.className = 'status-dot online';
      apiStatusText.textContent = 'API Connected';
    } else {
      throw new Error();
    }
  } catch (err) {
    statusDot.className = 'status-dot error';
    apiStatusText.textContent = 'API Offline (Use Demo)';
  }
}

// File Selection
function handleFileSelected(file) {
  if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
    showToast('Please select a JPEG, PNG, or WEBP image', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('File size must be under 5 MB', 'error');
    return;
  }

  state.selectedFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    imagePreview.src = e.target.result;
    dropZonePrompt.classList.add('hidden');
    previewWrapper.classList.remove('hidden');

    const img = new Image();
    img.src = e.target.result;
    img.onload = () => {
      const mb = (file.size / (1024 * 1024)).toFixed(2);
      previewMeta.textContent = `${img.naturalWidth} x ${img.naturalHeight} px &bull; ${mb} MB`;
    };
  };
  reader.readAsDataURL(file);
}

function clearSelectedFile() {
  state.selectedFile = null;
  fileInput.value = '';
  imagePreview.src = '';
  previewWrapper.classList.add('hidden');
  dropZonePrompt.classList.remove('hidden');
}

// Tag Inputs Setup
function setupTagInputs() {
  setupSingleTagInput('allergiesTagContainer', 'allergiesInput', 'allergies', true);
  setupSingleTagInput('medicinesTagContainer', 'medicinesInput', 'medicines', false);
  setupSingleTagInput('conditionsTagContainer', 'conditionsInput', 'conditions', false);
}

function setupSingleTagInput(containerId, inputId, stateKey, isAllergy) {
  const container = document.getElementById(containerId);
  const input = document.getElementById(inputId);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = input.value.trim().replace(/^,+|,+$/g, '');
      if (val && !state.tags[stateKey].includes(val)) {
        addTag(stateKey, val, container, input, isAllergy);
      }
      input.value = '';
    } else if (e.key === 'Backspace' && !input.value && state.tags[stateKey].length > 0) {
      removeTag(stateKey, state.tags[stateKey][state.tags[stateKey].length - 1], container, input, isAllergy);
    }
  });

  container.addEventListener('click', () => input.focus());
}

function addTag(key, value, container, input, isAllergy) {
  state.tags[key].push(value);
  renderTags(key, container, input, isAllergy);
}

function removeTag(key, value, container, input, isAllergy) {
  state.tags[key] = state.tags[key].filter(v => v !== value);
  renderTags(key, container, input, isAllergy);
}

function renderTags(key, container, input, isAllergy) {
  // Clear existing pills
  container.querySelectorAll('.tag-pill').forEach(el => el.remove());

  state.tags[key].forEach(val => {
    const pill = document.createElement('span');
    pill.className = `tag-pill ${isAllergy ? 'allergy' : ''}`;
    pill.innerHTML = `
      <span>${escapeHtml(val)}</span>
      <span class="tag-close">&times;</span>
    `;
    pill.querySelector('.tag-close').addEventListener('click', (e) => {
      e.stopPropagation();
      removeTag(key, val, container, input, isAllergy);
    });
    container.insertBefore(pill, input);
  });
}

function setTags(key, values, containerId, inputId, isAllergy) {
  state.tags[key] = [...values];
  const container = document.getElementById(containerId);
  const input = document.getElementById(inputId);
  renderTags(key, container, input, isAllergy);
}

// Preset Loader
function loadPreset(presetKey) {
  const p = PRESETS[presetKey];
  if (!p) return;

  document.getElementById('patientAge').value = p.age;
  document.getElementById('preferredLanguage').value = p.language;
  document.getElementById('pregnantToggle').checked = p.pregnant;
  document.getElementById('childToggle').checked = p.child;

  setTags('allergies', p.allergies, 'allergiesTagContainer', 'allergiesInput', true);
  setTags('medicines', p.medicines, 'medicinesTagContainer', 'medicinesInput', false);
  setTags('conditions', p.conditions, 'conditionsTagContainer', 'conditionsInput', false);

  // Generate synthetic prescription graphic on a canvas
  createSamplePrescriptionImage(p.sampleTitle, p.mockData.medications);

  showToast(`Loaded Preset: ${p.sampleTitle}`, 'info');
}

// Synthetic Prescription Image generator for testing
function createSamplePrescriptionImage(title, medications) {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');

  // Background Rx pad style
  ctx.fillStyle = '#faf8f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Clinic Header
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('ST. JUDE COMMUNITY CLINIC', 40, 50);

  ctx.fillStyle = '#475569';
  ctx.font = '14px sans-serif';
  ctx.fillText('Family Medicine & Prescription Care • Lic: MD-849204', 40, 75);
  ctx.fillText('Date: ' + new Date().toLocaleDateString(), 620, 75);

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 90);
  ctx.lineTo(760, 90);
  ctx.stroke();

  // Rx Symbol
  ctx.fillStyle = '#0891b2';
  ctx.font = 'bold 36px serif';
  ctx.fillText('℞', 40, 140);

  // Prescribed Meds
  ctx.fillStyle = '#1e293b';
  let y = 180;
  medications.forEach((m, idx) => {
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`${idx + 1}. ${m.source_text_from_image || (m.medicine_name + ' ' + (m.strength || ''))}`, 60, y);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`   Sig: ${m.dose} • ${m.frequency} • ${m.timing} (${m.food_instruction})`, 60, y + 24);
    ctx.fillStyle = '#1e293b';
    y += 70;
  });

  // Doctor Signature line
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(540, 520);
  ctx.lineTo(740, 520);
  ctx.stroke();
  ctx.fillStyle = '#475569';
  ctx.font = 'italic 18px cursive';
  ctx.fillText('Dr. S. Sharma, MD', 560, 510);
  ctx.font = '12px sans-serif';
  ctx.fillText('Physician Signature', 590, 540);

  canvas.toBlob((blob) => {
    const file = new File([blob], `${title.replace(/\s+/g, '_').toLowerCase()}.png`, { type: 'image/png' });
    handleFileSelected(file);
  }, 'image/png');
}

// Form Submission & API Call
async function handleFormSubmit(e) {
  e.preventDefault();

  if (!state.selectedFile) {
    showToast('Please select or upload a prescription image', 'error');
    return;
  }

  const ageVal = document.getElementById('patientAge').value.trim();
  const contextObj = {
    age: ageVal ? parseInt(ageVal, 10) : null,
    preferred_language: document.getElementById('preferredLanguage').value,
    conditions: state.tags.conditions,
    allergies: state.tags.allergies,
    current_medicines: state.tags.medicines,
    pregnant_or_breastfeeding: document.getElementById('pregnantToggle').checked,
    patient_is_child: document.getElementById('childToggle').checked
  };

  // Switch to loading
  scannerSection.classList.add('hidden');
  loadingSection.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Animate loading stepper
  simulateLoadingSteps();

  try {
    let carePlanData;

    if (state.isDemoMode) {
      // Offline / mock mode
      await new Promise(r => setTimeout(r, 1800));
      // Pick matching mock or default
      if (contextObj.allergies.some(a => a.toLowerCase().includes('penicillin'))) {
        carePlanData = {
          care_plan: PRESETS.allergy.mockData,
          requires_human_review: true,
          review_reasons: ["Possible allergy match", "High-severity safety flag", "Caregiver alert proposed (requires approval)"],
          request_id: 'demo_' + Date.now().toString(16)
        };
      } else if (contextObj.patient_is_child || (contextObj.age && contextObj.age < 12)) {
        carePlanData = {
          care_plan: PRESETS.pediatric.mockData,
          requires_human_review: true,
          review_reasons: ["Paediatric patient"],
          request_id: 'demo_' + Date.now().toString(16)
        };
      } else {
        carePlanData = {
          care_plan: PRESETS.diabetes.mockData,
          requires_human_review: Boolean(contextObj.age && contextObj.age >= 75),
          review_reasons: contextObj.age && contextObj.age >= 75 ? ["Elderly patient (polypharmacy risk)"] : [],
          request_id: 'demo_' + Date.now().toString(16)
        };
      }
    } else {
      // Real API transmission
      const formData = new FormData();
      formData.append('file', state.selectedFile);
      formData.append('context', JSON.stringify(contextObj));

      const apiKey = apiKeyInput.value.trim() || 'change-me-1';
      const baseUrl = apiUrlInput.value.trim() || '';

      const resp = await fetch(`${baseUrl}/v1/care-plan`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey
        },
        body: formData
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({ detail: 'Service error' }));
        throw new Error(errorData.detail || `Request failed with status ${resp.status}`);
      }

      carePlanData = await resp.json();
    }

    state.currentPlanResponse = carePlanData;
    renderCarePlan(carePlanData);

    loadingSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    loadingSection.classList.add('hidden');
    scannerSection.classList.remove('hidden');
    showToast(`Error: ${err.message}`, 'error');
  }
}

// Stepper animation during loading
function simulateLoadingSteps() {
  const steps = [
    { id: 'step1', title: 'Sanitizing Uploaded Image...', desc: 'Stripping camera metadata, GPS tags & resizing.' },
    { id: 'step2', title: 'Multimodal Vision Extraction...', desc: 'Gemini is recognizing handwritten medicine names & dosages.' },
    { id: 'step3', title: 'Deterministic Safety Checking...', desc: 'Verifying contraindications, allergies, and duplications.' },
    { id: 'step4', title: 'Building Localized Schedule...', desc: 'Formulating plain-language explanation & 24h timeline.' }
  ];

  let current = 0;
  const interval = setInterval(() => {
    current++;
    if (current < steps.length) {
      document.querySelectorAll('.step-item').forEach(s => s.classList.remove('active'));
      const activeEl = document.getElementById(steps[current].id);
      if (activeEl) activeEl.classList.add('active');
      document.getElementById('loadingTitle').textContent = steps[current].title;
      document.getElementById('loadingDesc').textContent = steps[current].desc;
    } else {
      clearInterval(interval);
    }
  }, 450);
}

// Render Care Plan
function renderCarePlan(data) {
  const plan = data.care_plan;
  const requiresReview = data.requires_human_review;
  const reasons = data.review_reasons || [];

  // 1. Safety Audit Banner
  const banner = document.getElementById('safetyAuditBanner');
  const hasEmergency = plan.potential_safety_flags && plan.potential_safety_flags.some(f => f.severity === 'emergency');

  if (hasEmergency) {
    banner.className = 'safety-audit-banner alert-emergency';
    banner.innerHTML = `
      <div class="banner-icon">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <div class="banner-content">
        <h4>CRITICAL SAFETY ALERT &bull; IMMEDIATE HUMAN REVIEW MANDATORY</h4>
        <p>A high-severity clinical conflict was detected. Do not proceed until verified by a medical professional.</p>
        <div class="reasons-tags">
          ${reasons.map(r => `<span class="reason-tag">⚠️ ${escapeHtml(r)}</span>`).join('')}
        </div>
      </div>
    `;
  } else if (requiresReview) {
    banner.className = 'safety-audit-banner alert-review';
    banner.innerHTML = `
      <div class="banner-icon">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </div>
      <div class="banner-content">
        <h4>Pharmacist or Clinician Review Recommended</h4>
        <p>This prescription requires clinical check before automated alerts are sent.</p>
        <div class="reasons-tags">
          ${reasons.map(r => `<span class="reason-tag">${escapeHtml(r)}</span>`).join('')}
        </div>
      </div>
    `;
  } else {
    banner.className = 'safety-audit-banner alert-clean';
    banner.innerHTML = `
      <div class="banner-icon">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      </div>
      <div class="banner-content">
        <h4>Confidence High &bull; No Safety Clashes Detected</h4>
        <p>Prescription was clearly extracted. Follow schedule and medical instructions as prescribed.</p>
      </div>
    `;
  }

  // 2. Plain Language Summary
  document.getElementById('patientFriendlySummaryText').textContent = plan.patient_friendly_summary || 'No summary available.';
  document.getElementById('medsCountBadge').textContent = (plan.medications || []).length;
  document.getElementById('safetyCountBadge').textContent = (plan.potential_safety_flags || []).length;

  // 3. 24h Timeline
  const timelineEl = document.getElementById('scheduleTimeline');
  if (!plan.daily_schedule || plan.daily_schedule.length === 0) {
    timelineEl.innerHTML = `<p class="text-secondary">No daily schedule slots generated.</p>`;
  } else {
    timelineEl.innerHTML = plan.daily_schedule.map(slot => `
      <div class="timeline-slot">
        <div class="slot-time">${escapeHtml(slot.time)}</div>
        <div class="slot-content">
          <div class="slot-meds">
            ${slot.medicines.map(m => `<span class="slot-med-pill">💊 ${escapeHtml(m)}</span>`).join('')}
          </div>
          <div class="slot-instruction">${escapeHtml(slot.instruction)}</div>
          ${slot.reminder_message ? `<div class="slot-reminder">🔔 ${escapeHtml(slot.reminder_message)}</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  // 4. Extracted Medication Cards
  const medsGrid = document.getElementById('medicationsGrid');
  if (!plan.medications || plan.medications.length === 0) {
    medsGrid.innerHTML = `<p class="text-secondary">No medications were extracted from this prescription.</p>`;
  } else {
    medsGrid.innerHTML = plan.medications.map(m => `
      <div class="medication-card">
        <div>
          <div class="med-header">
            <div class="med-name">${escapeHtml(m.medicine_name)}</div>
            ${m.strength ? `<span class="med-strength">${escapeHtml(m.strength)}</span>` : ''}
          </div>
          <div class="med-tags">
            <span class="badge badge-info">${escapeHtml(m.form)}</span>
            <span class="badge badge-success">${formatFoodInstruction(m.food_instruction)}</span>
            <span class="badge badge-warning">${escapeHtml(m.frequency)}</span>
          </div>
          <p class="med-purpose">💡 ${escapeHtml(m.plain_language_purpose)}</p>
          ${m.important_warnings && m.important_warnings.length > 0 ? `
            <div class="text-muted mt-2">
              <strong>Warnings:</strong>
              <ul style="padding-left: 1.2rem; margin-top: 0.25rem;">
                ${m.important_warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
        ${m.source_text_from_image ? `
          <div class="med-source">
            Original Rx Text: "${escapeHtml(m.source_text_from_image)}"
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  // 5. Safety Flags List
  const flagsList = document.getElementById('safetyFlagsList');
  if (!plan.potential_safety_flags || plan.potential_safety_flags.length === 0) {
    flagsList.innerHTML = `<p class="text-secondary">No safety flags raised.</p>`;
  } else {
    flagsList.innerHTML = plan.potential_safety_flags.map(f => `
      <div class="flag-card flag-${escapeHtml(f.severity)}">
        <div class="flag-header">
          <span class="badge badge-${f.severity === 'emergency' ? 'danger' : f.severity === 'high' ? 'warning' : 'info'}">
            ${escapeHtml(f.severity.toUpperCase())}
          </span>
          <span class="flag-issue">${escapeHtml(f.issue)}</span>
        </div>
        <div class="flag-action">
          <strong>Recommended Action:</strong> ${escapeHtml(f.recommended_action)}
        </div>
      </div>
    `).join('');
  }

  // 6. Missed Dose Guidance & Questions
  document.getElementById('missedDoseText').textContent = plan.missed_dose_guidance || 'Follow pharmacist advice on missed doses.';

  const qList = document.getElementById('followUpQuestionsList');
  if (plan.follow_up_questions_for_patient && plan.follow_up_questions_for_patient.length > 0) {
    qList.innerHTML = plan.follow_up_questions_for_patient.map(q => `<li>${escapeHtml(q)}</li>`).join('');
  } else {
    qList.innerHTML = `<li>No additional follow-up questions noted.</li>`;
  }

  // 7. Disclaimer
  document.getElementById('medicalDisclaimerText').textContent = plan.medical_disclaimer;
}

function formatFoodInstruction(inst) {
  const map = {
    'before_food': 'Before Food 🍽️',
    'after_food': 'After Food 🥗',
    'with_food': 'With Meal 🍲',
    'empty_stomach': 'Empty Stomach ⏳',
    'no_restriction': 'No Food Restriction',
    'unclear': 'Timing Unclear'
  };
  return map[inst] || inst;
}

// Tab Switching
function switchTab(tabKey) {
  state.activeTab = tabKey;
  document.querySelectorAll('.view-tab').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-tab') === tabKey);
  });

  document.getElementById('tabSchedule').classList.toggle('hidden', tabKey !== 'schedule');
  document.getElementById('tabMedications').classList.toggle('hidden', tabKey !== 'medications');
  document.getElementById('tabSafety').classList.toggle('hidden', tabKey !== 'safety');
}

// Text-to-Speech (Web Speech API)
function toggleTTS() {
  if (!state.speechSynth) {
    showToast('Text to Speech is not supported in this browser', 'error');
    return;
  }

  if (state.speechSynth.speaking) {
    stopTTS();
    return;
  }

  const textToRead = document.getElementById('patientFriendlySummaryText').textContent;
  if (!textToRead) return;

  const utterance = new SpeechSynthesisUtterance(textToRead);
  const preferredLang = document.getElementById('preferredLanguage').value;

  // Attempt voice selection
  const voices = state.speechSynth.getVoices();
  const langCodes = {
    'Hindi': 'hi-IN',
    'Spanish': 'es-ES',
    'Bengali': 'bn-IN',
    'Tamil': 'ta-IN',
    'Telugu': 'te-IN',
    'Marathi': 'mr-IN',
    'French': 'fr-FR',
    'Arabic': 'ar-SA',
    'English': 'en-US'
  };

  const targetCode = langCodes[preferredLang] || 'en-US';
  utterance.lang = targetCode;
  const matchVoice = voices.find(v => v.lang.startsWith(targetCode.slice(0, 2)));
  if (matchVoice) utterance.voice = matchVoice;

  utterance.rate = 0.95;
  utterance.pitch = 1.0;

  utterance.onstart = () => {
    ttsBtnLabel.textContent = 'Speaking...';
    ttsStopBtn.classList.remove('hidden');
  };

  utterance.onend = utterance.onerror = () => {
    stopTTS();
  };

  state.currentUtterance = utterance;
  state.speechSynth.speak(utterance);
}

function stopTTS() {
  if (state.speechSynth && state.speechSynth.speaking) {
    state.speechSynth.cancel();
  }
  ttsBtnLabel.textContent = 'Listen Aloud';
  ttsStopBtn.classList.add('hidden');
}

// Config & Settings
function saveConfiguration() {
  const key = apiKeyInput.value.trim();
  const url = apiUrlInput.value.trim();
  const isMock = mockModeCheckbox.checked;

  localStorage.setItem('medibridge_api_key', key);
  localStorage.setItem('medibridge_api_url', url);
  enableDemoMode(isMock);

  configModal.classList.add('hidden');
  checkBackendHealth();
  showToast('Settings Saved', 'info');
}

function enableDemoMode(enable) {
  state.isDemoMode = enable;
  demoModeLabel.textContent = enable ? 'ON' : 'Off';
  demoModeToggle.classList.toggle('active', enable);
  mockModeCheckbox.checked = enable;
  localStorage.setItem('medibridge_demo_mode', enable ? 'true' : 'false');
}

// Copy JSON
function copyRawJson() {
  if (!state.currentPlanResponse) return;
  navigator.clipboard.writeText(JSON.stringify(state.currentPlanResponse, null, 2))
    .then(() => showToast('Care plan JSON copied to clipboard!', 'info'))
    .catch(() => showToast('Failed to copy to clipboard', 'error'));
}

// Toast Notification
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
  toast.style.borderColor = type === 'error' ? 'var(--rose-500)' : 'var(--cyan-500)';
  toast.innerHTML = `<span>${escapeHtml(msg)}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
