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
    
    // Password protection
    passwordOverlay: document.getElementById('password-overlay'),
    passwordInput: document.getElementById('app-password-input'),
    unlockBtn: document.getElementById('unlock-btn'),
    passwordError: document.getElementById('password-error'),

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
    masterpieceImg: document.getElementById('masterpiece-img'),
    downloadBtn: document.getElementById('download-btn'),

    // Loader
    loaderOverlay: document.getElementById('loader-overlay'),
    loaderTitle: document.getElementById('loader-title'),
    loaderMsg: document.getElementById('loader-msg')
  };

  const ctx = elements.composerCanvas.getContext('2d');
  let cameraStream = null;

  // Default password hash for "camcam" (using pure-JS simpleHash for compatibility)
  const CORRECT_PASSWORD_HASH = "f5e67b47";

  // Initialize
  initApp();

  async function initApp() {
    // Check local storage for unlocked state
    const isUnlocked = localStorage.getItem('gemini_cam_unlocked') === 'true';
    if (isUnlocked && elements.passwordOverlay) {
      elements.passwordOverlay.style.setProperty('display', 'none', 'important');
      elements.passwordOverlay.classList.add('hidden');
    } else if (elements.passwordOverlay) {
      elements.passwordOverlay.style.setProperty('display', 'flex', 'important');
      elements.passwordOverlay.classList.remove('hidden');
      elements.passwordInput.focus();
    }

    // Check server config for token first, then fallback to local storage key
    try {
      const res = await fetch('/api/config');
      const config = await res.json();
      state.hasApiToken = config.hasToken || !!localStorage.getItem('gemini_api_key');
    } catch (e) {
      state.hasApiToken = !!localStorage.getItem('gemini_api_key');
    }
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
    // Password Unlock Events
    if (elements.unlockBtn) {
      elements.unlockBtn.addEventListener('click', handleUnlock);
    }
    if (elements.passwordInput) {
      elements.passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleUnlock();
      });
    }

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

  function simpleHash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
  }

  function handleUnlock() {
    const password = elements.passwordInput.value.trim();
    if (!password) return;

    const hash = simpleHash(password);
    if (hash === CORRECT_PASSWORD_HASH) {
      localStorage.setItem('gemini_cam_unlocked', 'true');
      elements.passwordOverlay.style.setProperty('display', 'none', 'important');
      elements.passwordOverlay.classList.add('hidden');
      elements.passwordError.classList.add('hidden');
    } else {
      elements.passwordError.classList.remove('hidden');
      elements.passwordInput.value = '';
      elements.passwordInput.focus();
    }
  }

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
      // Use standard camera constraints (simplest and most compatible across all browsers/devices)
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });
      elements.cameraVideo.srcObject = cameraStream;
    } catch (err) {
      console.error("Camera access failed:", err);
      alert("Could not access your camera. Please check browser permissions or upload an image instead.");
      stopCamera();
    }
  }

  // Helper to check device orientation
  function isDevicePortrait() {
    return window.innerHeight > window.innerWidth;
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
    
    let vWidth = video.videoWidth || video.width || 640;
    let vHeight = video.videoHeight || video.height || 480;

    if (vWidth === 0) vWidth = 640;
    if (vHeight === 0) vHeight = 480;

    // Calculate crop to match the 3:4 portrait aspect ratio of the viewfinder container
    const targetAspect = 3 / 4;
    const currentAspect = vWidth / vHeight;
    
    let cropW, cropH, startX, startY;
    if (currentAspect > targetAspect) {
      // Stream is wider than 3:4 (standard landscape)
      cropH = vHeight;
      cropW = vHeight * targetAspect;
      startX = (vWidth - cropW) / 2;
      startY = 0;
    } else {
      // Stream is taller than 3:4
      cropW = vWidth;
      cropH = vWidth / targetAspect;
      startX = 0;
      startY = (vHeight - cropH) / 2;
    }

    canvas.width = cropW;
    canvas.height = cropH;

    const cCtx = canvas.getContext('2d');
    
    // Draw mirrored selfie cropped to 3:4 portrait
    cCtx.translate(cropW, 0);
    cCtx.scale(-1, 1);
    cCtx.drawImage(video, startX, startY, cropW, cropH, 0, 0, cropW, cropH);
    
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
      canvas.width = (canvas.height * img.width) / img.height;
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

  // Helper to extract base64 from image element securely
  function getImageBase64(imgElement) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imgElement.width;
    tempCanvas.height = imgElement.height;
    const tCtx = tempCanvas.getContext('2d');
    tCtx.drawImage(imgElement, 0, 0);
    return tempCanvas.toDataURL('image/jpeg', 0.95).split(',')[1];
  }

  async function blendCompositeImage() {
    if (!state.originalSelfieImage || !state.camImage) return;

    // Reset UI display elements
    elements.composerCanvas.classList.remove('hidden');
    elements.masterpieceImg.classList.add('hidden');

    showLoader(
      state.hasApiToken ? 'Gemini is merging photos...' : 'Loading mock preview...',
      state.hasApiToken 
        ? 'Calling Google Gemini Nano Banana model directly to generate you standing next to Cam. This will take ~10 seconds.'
        : 'Displaying side-by-side mock preview. Enter a Google Gemini API Key to enable the actual AI.'
    );

    try {
      // Generate side-by-side composite (used as a fallback / mock preview)
      const compositeDataUrl = createSideBySideComposite();

      if (state.hasApiToken) {
        const localKey = localStorage.getItem('gemini_api_key');
        const prompt = "Please create a single, unified photograph where the person from Image 1 (my selfie) and the person from Image 2 (Cam) are posing together, standing side-by-side in a cohesive environment. CRITICAL REQUIREMENT: Do NOT split the output image into two halves. Do NOT show the reference photos as a split-screen or side-by-side comparison. You must generate a single cohesive photo of the two people standing together in a single unified setting with no borders, panels, or frames. Treat this as a single portrait shot. The faces must remain highly accurate and true to their respective original images, preserving their exact facial features, details, expressions, and identities.";
        
        const selfieBase64 = state.originalSelfieImage.src.split(',')[1];
        const camBase64 = getImageBase64(state.camImage);
        let responseUrl = '';

        if (localKey) {
          // --- LIVE AI MODE: Direct browser call to Google Gemini (uses local key) ---
          // Fetch available models to dynamically select the active image generation model
          const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${localKey}`);
          if (!modelsRes.ok) {
            throw new Error('Failed to fetch Google Gemini model list. Please check if your API Key is correct.');
          }
          const modelsData = await modelsRes.json();
          const allModels = modelsData.models || [];
          
          // Find the best available image/imagen model dynamically
          let selectedModel = allModels.find(m => m.name.includes('flash-image') || m.name.includes('pro-image'));
          if (!selectedModel) {
            selectedModel = allModels.find(m => m.name.includes('imagen') || m.name.includes('image'));
          }

          if (!selectedModel) {
            throw new Error('Could not find an image generation model on your Google AI Studio account. Verify model list permissions.');
          }

          const modelName = selectedModel.name;
          console.log("Dynamically Selected Image Model:", modelName);

          const supportsGenerateImages = selectedModel.supportedGenerationMethods?.includes('generateImages') || modelName.includes('imagen');

          if (supportsGenerateImages) {
            // --- LEGACY IMAGEN generateImages PATH (Single Text Prompt only) ---
            const legacyPrompt = "Please create a single, unified photograph of these two people posing together in the same camera frame. You must blend them seamlessly into a single environment (like standing side-by-side next to each other). CRITICAL REQUIREMENT: Do NOT output two separate images side-by-side or split the screen; they must be fully integrated into a single cohesive scene with no borders, panels, or comparisons.";
            const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateImages?key=${localKey}`;
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: legacyPrompt + ", high-quality photograph, realistic details",
                numberOfImages: 1,
                outputMimeType: "image/jpeg",
                aspectRatio: "1:1",
                personGeneration: "ALLOW_ADULT"
              })
            });
            if (!res.ok) {
              const errJson = await res.json().catch(() => ({}));
              throw new Error(errJson.error?.message || `HTTP ${res.status} from ${modelName}`);
            }
            const data = await res.json();
            const base64Out = data.generatedImages?.[0]?.image?.imageBytes;
            if (!base64Out) {
              throw new Error('Model returned success but no image bytes.');
            }
            responseUrl = `data:image/jpeg;base64,${base64Out}`;

          } else {
            // --- NEW GEMINI generateContent MULTIMODAL PATH ---
            const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${localKey}`;
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    role: "user",
                    parts: [
                      { text: prompt },
                      {
                        inlineData: {
                          mimeType: "image/jpeg",
                          data: selfieBase64
                        }
                      },
                      {
                        inlineData: {
                          mimeType: "image/jpeg",
                          data: camBase64
                        }
                      }
                    ]
                  }
                ],
                generationConfig: {
                  responseModalities: ["TEXT", "IMAGE"]
                }
              })
            });
            if (!res.ok) {
              const errJson = await res.json().catch(() => ({}));
              throw new Error(errJson.error?.message || `HTTP ${res.status} from ${modelName}`);
            }
            const data = await res.json();
            const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
            if (!part) {
              throw new Error('Model returned success but no generated image data.');
            }
            responseUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          }
        } else {
          // --- LIVE AI MODE: Call our secure serverless backend endpoint ---
          const res = await fetch('/api/blend-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              selfie: selfieBase64,
              cam: camBase64,
              prompt: prompt
            })
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${res.status} from server`);
          }
          const data = await res.json();
          responseUrl = data.imageUrl;
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

        // Show the image overlay and hide canvas to allow tap-and-hold saving on mobile
        elements.masterpieceImg.src = responseUrl;
        elements.masterpieceImg.classList.remove('hidden');
        elements.composerCanvas.classList.add('hidden');

      } else {
        // --- DEMO MOCK MODE: Just show the raw side-by-side composite ---
        const mockImg = new Image();
        await new Promise((resolve) => {
          mockImg.onload = resolve;
          mockImg.src = compositeDataUrl;
        });
        state.selfieImage = mockImg;

        elements.masterpieceImg.src = compositeDataUrl;
        elements.masterpieceImg.classList.remove('hidden');
        elements.composerCanvas.classList.add('hidden');
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
  // EXPORT MASTERPIECE (NATIVE SHARE SHEET OR DOWNLOAD FALLBACK)
  // ==========================================================================

  function downloadMasterpiece() {
    drawComposer();

    const canvas = elements.composerCanvas;
    
    // Try to use Web Share API for native "Save Image" to Photo Stream on iOS/Android
    if (navigator.canShare && navigator.share) {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          fallbackDownload(canvas);
          return;
        }
        const file = new File([blob], `gemini-cam-cam-${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: 'Gemini Cam Cam Masterpiece',
              text: 'Look at me standing next to Cam!'
            });
            console.log("Masterpiece shared successfully via native share sheet.");
          } catch (err) {
            console.warn("Share sheet cancelled or failed, falling back to download:", err);
            fallbackDownload(canvas);
          }
        } else {
          fallbackDownload(canvas);
        }
      }, 'image/jpeg', 0.95);
    } else {
      fallbackDownload(canvas);
    }
  }

  function fallbackDownload(canvas) {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const link = document.createElement('a');
    link.download = `gemini-cam-cam-masterpiece-${Date.now()}.jpg`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
});
