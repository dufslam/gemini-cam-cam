// ==========================================================================
// NANO BANANA CAM-POSER - APP MOTOR (100% PURE CLIENT-SIDE / GOOGLE GEMINI)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Global State
  const state = {
    hasApiToken: false,
    activeStep: 1,
    camImage: null,          // Image object for Cam (the ingredient)
    selfieImage: null,       // Current background image (can be blended result)
    originalSelfieImage: null, // Backup of original captured selfie
    
    // Canvas dimensions (for calculations)
    canvasWidth: 800,
    canvasHeight: 600,
  };

  // UI Selectors
  const elements = {
    modeBadge: document.getElementById('mode-badge'),
    settingsBtn: document.getElementById('settings-btn'),
    settingsPanel: document.getElementById('settings-panel'),
    closeSettings: document.getElementById('close-settings'),
    apiTokenInput: document.getElementById('api-token-input'),
    saveTokenBtn: document.getElementById('save-token-btn'),
    clearTokenBtn: document.getElementById('clear-token-btn'),
    
    // Step 1
    step1: document.getElementById('step-1'),
    startCameraBtn: document.getElementById('start-camera-btn'),
    capturePhotoBtn: document.getElementById('capture-photo-btn'),
    uploadSelfieBtn: document.getElementById('upload-selfie-btn'),
    selfieFileInput: document.getElementById('selfie-file-input'),
    cameraVideo: document.getElementById('camera-video'),
    cameraCanvas: document.getElementById('camera-canvas'),
    cameraPlaceholder: document.getElementById('camera-placeholder'),
    cameraStreamWrapper: document.getElementById('camera-stream-wrapper'),

    // Step 2
    step2: document.getElementById('step-2'),
    canvasContainer: document.getElementById('canvas-container'),
    composerCanvas: document.getElementById('composer-canvas'),
    downloadBtn: document.getElementById('download-btn'),

    // Loader
    loaderOverlay: document.getElementById('loader-overlay'),
    loaderTitle: document.getElementById('loader-title'),
    loaderMsg: document.getElementById('loader-msg')
  };

  const ctx = elements.composerCanvas.getContext('2d');
  let cameraStream = null;

  // Initialize
  initApp();

  async function initApp() {
    // Check local storage for key
    state.hasApiToken = !!localStorage.getItem('gemini_api_key');
    updateBadge();

    // Retrieve saved token if any
    const savedToken = localStorage.getItem('gemini_api_key');
    if (savedToken) {
      elements.apiTokenInput.value = savedToken;
    }

    // Pre-load the pre-saved Cam image
    loadSavedCamOnBoot();

    setupEventListeners();
  }

  // ==========================================================================
  // EVENT LISTENERS & SETUP
  // ==========================================================================

  function setupEventListeners() {
    // Settings Panel Toggle
    elements.settingsBtn.addEventListener('click', () => {
      elements.settingsPanel.classList.toggle('hidden');
    });
    elements.closeSettings.addEventListener('click', () => {
      elements.settingsPanel.classList.add('hidden');
    });

    // Save/Clear Token
    elements.saveTokenBtn.addEventListener('click', saveToken);
    elements.clearTokenBtn.addEventListener('click', clearToken);

    // Step 1: Camera & Selfie Upload
    elements.startCameraBtn.addEventListener('click', startCamera);
    elements.capturePhotoBtn.addEventListener('click', captureSelfie);
    elements.uploadSelfieBtn.addEventListener('click', () => elements.selfieFileInput.click());
    elements.selfieFileInput.addEventListener('change', handleSelfieUpload);

    elements.downloadBtn.addEventListener('click', downloadMasterpiece);
  }

  // ==========================================================================
  // CORE CONTROLLERS
  // ==========================================================================

  function updateBadge() {
    if (state.hasApiToken) {
      elements.modeBadge.className = 'mode-badge live-badge';
      elements.modeBadge.innerHTML = '<i class="fa-solid fa-bolt"></i> Live Gemini Mode';
    } else {
      elements.modeBadge.className = 'mode-badge mock-badge';
      elements.modeBadge.innerHTML = '<i class="fa-solid fa-flask"></i> Demo Mock Mode';
    }
  }

  function saveToken() {
    const token = elements.apiTokenInput.value.trim();
    if (!token) return;
    localStorage.setItem('gemini_api_key', token);
    
    alert("Google Gemini API Key saved locally! The app will now connect directly to Gemini.");
    state.hasApiToken = true;
    updateBadge();
    elements.settingsPanel.classList.add('hidden');
  }

  function clearToken() {
    elements.apiTokenInput.value = '';
    localStorage.removeItem('gemini_api_key');
    state.hasApiToken = false;
    updateBadge();
    elements.settingsPanel.classList.add('hidden');
  }

  function setStep(stepNum) {
    state.activeStep = stepNum;
    for (let i = 1; i <= 2; i++) {
      const card = document.getElementById(`step-${i}`);
      if (i <= stepNum) {
        card.classList.remove('disabled');
      } else {
        card.classList.add('disabled');
      }
    }
    // Smooth scroll to the current step
    document.getElementById(`step-${stepNum}`).scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function showLoader(title, msg) {
    elements.loaderTitle.innerText = title;
    elements.loaderMsg.innerText = msg;
    elements.loaderOverlay.classList.remove('hidden');
  }

  function hideLoader() {
    elements.loaderOverlay.classList.add('hidden');
  }

  // ==========================================================================
  // STEP 1 LOGIC - PRELOAD CAM & CAMERA LOGIC
  // ==========================================================================

  function loadSavedCamOnBoot() {
    const savedCamSrc = 'assets/cam.jpg';
    const img = new Image();
    img.onload = () => {
      state.camImage = img;
      console.log("Pre-saved Cam image pre-loaded successfully!");
    };
    img.onerror = () => {
      console.warn("Could not load assets/cam.jpg. Please check if the file is present.");
    };
    img.src = savedCamSrc;
  }

  async function startCamera() {
    elements.cameraPlaceholder.classList.add('hidden');
    elements.cameraVideo.classList.remove('hidden');
    elements.startCameraBtn.classList.add('hidden');
    elements.capturePhotoBtn.classList.remove('hidden');

    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      elements.cameraVideo.srcObject = cameraStream;
    } catch (err) {
      console.error("Camera access failed:", err);
      alert("Could not access your camera. Please check browser permissions or upload an image instead.");
      stopCamera();
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
    elements.cameraVideo.classList.add('hidden');
    elements.cameraPlaceholder.classList.remove('hidden');
    elements.startCameraBtn.classList.remove('hidden');
    elements.capturePhotoBtn.classList.add('hidden');
  }

  function captureSelfie() {
    const video = elements.cameraVideo;
    const canvas = elements.cameraCanvas;
    const vWidth = video.videoWidth;
    const vHeight = video.videoHeight;

    canvas.width = vWidth;
    canvas.height = vHeight;

    const cCtx = canvas.getContext('2d');
    
    // Draw mirrored selfie to look natural to the user
    cCtx.translate(vWidth, 0);
    cCtx.scale(-1, 1);
    cCtx.drawImage(video, 0, 0, vWidth, vHeight);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    loadSelfieImage(dataUrl);
  }

  function handleSelfieUpload() {
    const file = elements.selfieFileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      loadSelfieImage(e.target.result);
    };
    reader.readAsDataURL(file);
  }

  function loadSelfieImage(src) {
    const img = new Image();
    img.onload = async () => {
      state.selfieImage = img;
      state.originalSelfieImage = img; // Back up original photo
      
      // Stop webcam stream if running
      stopCamera();

      // Automatically generate the side-by-side composite and call Gemini
      try {
        await blendCompositeImage();
        setStep(2); // Advance to workspace
      } catch (err) {
        console.error("Failed to generate combined image:", err);
      }
    };
    img.src = src;
  }

  // ==========================================================================
  // COMPOSER & GOOGLE GEMINI DIRECT API INTEGRATION
  // ==========================================================================

  function setupComposerDimensions() {
    const canvas = elements.composerCanvas;
    const img = state.selfieImage;

    const maxDim = 800; // Cap visual display size for layout
    if (img.width > img.height) {
      canvas.width = Math.min(img.width, maxDim);
      canvas.height = (canvas.width * img.height) / img.width;
    } else {
      canvas.height = Math.min(img.height, maxDim);
      canvas.width = (canvas.height * img.height) / img.height;
    }
  }

  function drawComposer() {
    if (!state.selfieImage) return;
    const canvas = elements.composerCanvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(state.selfieImage, 0, 0, canvas.width, canvas.height);
  }

  function createSideBySideComposite() {
    // Create a temporary canvas to merge both photos side-by-side
    const tempCanvas = document.createElement('canvas');
    const selfie = state.originalSelfieImage;
    const cam = state.camImage;

    // Normalize height to 1024px for balanced scaling in the AI model
    const targetH = 1024;
    const selfieW = (targetH * selfie.width) / selfie.height;
    const camW = (targetH * cam.width) / cam.height;

    tempCanvas.width = selfieW + camW;
    tempCanvas.height = targetH;

    const tCtx = tempCanvas.getContext('2d');
    
    // Draw selfie on left
    tCtx.drawImage(selfie, 0, 0, selfieW, targetH);
    // Draw Cam on right
    tCtx.drawImage(cam, selfieW, 0, camW, targetH);

    return tempCanvas.toDataURL('image/jpeg', 0.9);
  }

  async function blendCompositeImage() {
    if (!state.originalSelfieImage || !state.camImage) return;

    showLoader(
      state.hasApiToken ? 'Gemini is merging photos...' : 'Loading mock preview...',
      state.hasApiToken 
        ? 'Calling Google Gemini Nano Banana model directly to generate you standing next to Cam. This will take ~10 seconds.'
        : 'Displaying side-by-side mock preview. Enter a Google Gemini API Key to enable the actual AI.'
    );

    try {
      // 1. Generate side-by-side composite
      const compositeDataUrl = createSideBySideComposite();

      if (state.hasApiToken) {
        // --- LIVE AI MODE: Direct browser call to Google Gemini ---
        const prompt = "please create an image where these two people are posing together for the photo";
        const localKey = localStorage.getItem('gemini_api_key');
        if (!localKey) {
          throw new Error('API key is missing. Please save it in the settings panel.');
        }

        // Parse base64 parts from data URL
        const base64Data = compositeDataUrl.split(',')[1];

        // Call Google AI Studio endpoint directly from browser
        let responseUrl = '';
        const body = {
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: base64Data
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"]
          }
        };

        const tryModel = async (modelName) => {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${localKey}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
          });
          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(errJson.error?.message || `HTTP ${res.status} from ${modelName}`);
          }
          const data = await res.json();
          const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
          if (!part) {
            throw new Error(`Model ${modelName} returned content but no generated image data.`);
          }
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        };

        try {
          responseUrl = await tryModel("gemini-2.5-flash-image");
        } catch (err) {
          console.warn("gemini-2.5-flash-image failed, trying fallback model imagen-3.0-generate-002...", err);
          responseUrl = await tryModel("imagen-3.0-generate-002");
        }

        // Load the generated result
        const generatedImg = new Image();
        generatedImg.crossOrigin = 'Anonymous';
        await new Promise((resolve, reject) => {
          generatedImg.onload = resolve;
          generatedImg.onerror = reject;
          generatedImg.src = responseUrl;
        });

        state.selfieImage = generatedImg;
      } else {
        // --- DEMO MOCK MODE: Just show the raw side-by-side composite ---
        const mockImg = new Image();
        await new Promise((resolve) => {
          mockImg.onload = resolve;
          mockImg.src = compositeDataUrl;
        });
        state.selfieImage = mockImg;
      }

      // Configure dimensions and draw
      setupComposerDimensions();
      drawComposer();
      hideLoader();

    } catch (error) {
      console.error(error);
      hideLoader();
      alert(`Blending failed: ${error.message || 'Check your Gemini key and console logs.'}`);
    }
  }

  // ==========================================================================
  // EXPORT MASTERPIECE
  // ==========================================================================

  function downloadMasterpiece() {
    drawComposer();
    const dataUrl = elements.composerCanvas.toDataURL('image/jpeg', 0.95);
    
    const link = document.createElement('a');
    link.download = `gemini-cam-cam-masterpiece-${Date.now()}.jpg`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
});
