import {
    FaceDetector,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

// =====================================
// MEDIAPIPE FACE DETECTOR
// =====================================

let faceDetector = null;
let faceDetectorReady = false;
let cameraReady = false;

// Separate VIDEO-mode detector for live face tracking.
// The original IMAGE-mode detector remains unchanged for photo-quality checks.
let liveFaceDetector = null;
let liveFaceDetectorReady = false;
let liveTrackingStarted = false;
let lastLiveDetectionAt = 0;
let noFaceFrames = 0;

function updateCameraReadyState() {

    if (cameraReady && faceDetectorReady && faceDetector) {

        captureBtn.hidden = false;
        captureBtn.disabled = false;

        status.innerHTML = "✅ Ready — Take Photo";

        console.log("✅ Camera System Fully Ready");

    } else {

        captureBtn.hidden = true;
        captureBtn.disabled = true;

    }

}

async function initFaceDetector() {

    try {

        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );

        const MODEL =
            "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

        // IMAGE detector: CPU lang (mas matatag sa lumang iPhone)
        faceDetector = await FaceDetector.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL, delegate: "CPU" },
            runningMode: "IMAGE",
            minDetectionConfidence: 0.5
        });

        console.log("✅ MediaPipe Face Detector Ready (CPU)");

        // LIVE tracker: huwag gawin sa iOS 16 pababa
        const isOldIOS = /iPhone OS (1[0-6])_/.test(navigator.userAgent);

        if (!isOldIOS) {

            try {

                liveFaceDetector = await FaceDetector.createFromOptions(vision, {
                    baseOptions: { modelAssetPath: MODEL, delegate: "CPU" },
                    runningMode: "VIDEO",
                    minDetectionConfidence: 0.5
                });

                liveFaceDetectorReady = true;
                console.log("✅ Live Face Tracker Ready");

            } catch (liveError) {

                liveFaceDetector = null;
                liveFaceDetectorReady = false;
                console.warn("⚠️ Live face tracking unavailable:", liveError);

            }

        }

        faceDetectorReady = true;

        updateCameraReadyState();
        startLiveFaceTracking();

    } catch (error) {

        console.error("❌ MediaPipe Face Detector failed:", error);

        faceDetectorReady = false;
        faceDetector = null;

        captureBtn.hidden = true;
        captureBtn.disabled = true;

        status.innerHTML =
            "⚠️ AI Scanner failed to load.<br><br>" +
            "Please reload the camera.";

    }
}
// =====================================
// DETECT FACES
// =====================================

function detectFaces() {

    if (!faceDetector) {

        throw new Error(
            "Face detector is not ready."
        );

    }

    const result = faceDetector.detect(canvas);

    const detections = result.detections || [];

    // No face
    if (detections.length === 0) {

        return {

            detected: false,

            faces: [],

            primaryFace: null

        };

    }

    // Find the largest detected face
    let primaryFace = detections[0];

    let primaryArea =
        primaryFace.boundingBox.width *
        primaryFace.boundingBox.height;

    for (let i = 1; i < detections.length; i++) {

        const face = detections[i];

        const area =
            face.boundingBox.width *
            face.boundingBox.height;

        if (area > primaryArea) {

            primaryFace = face;

            primaryArea = area;

        }

    }

    return {

        detected: true,

        faces: detections,

        primaryFace: primaryFace

    };

}

// =====================================
// LIVE FACE TRACKING
// =====================================

// One independent guide is maintained for every face returned by MediaPipe.
// The original #guide is reused for face 1; extra guides are cloned as needed.
let faceGuides = [];

function ensureFaceGuideCount(count) {

    while (faceGuides.length < count) {

        const clone = guide.cloneNode(true);
        clone.removeAttribute("id");
        clone.classList.add("face-guide-overlay");
        clone.hidden = true;
        clone.classList.remove("is-tracking");
        clone.style.left = "50%";
        clone.style.top = "50%";
        clone.style.width = "190px";
        clone.style.height = "240px";

        // The companion CSS gives .face-guide-overlay the same styling as #guide.
        guide.parentElement.appendChild(clone);
        faceGuides.push(clone);

    }

}

function hideUnusedFaceGuides(firstUnusedIndex = 0) {

    for (let i = firstUnusedIndex; i < faceGuides.length; i++) {
        faceGuides[i].classList.remove("is-tracking");
        faceGuides[i].hidden = true;
    }

}

function startLiveFaceTracking() {

    if (liveTrackingStarted) return;

    liveTrackingStarted = true;

    function trackingFrame() {

        if (
            liveFaceDetectorReady &&
            liveFaceDetector &&
            video &&
            !video.hidden &&
            guide &&
            video.readyState >= 2 &&
            video.videoWidth > 0 &&
            video.videoHeight > 0
        ) {

            const now = performance.now();

            // Around 8 detections per second is enough for smooth tracking
            // while keeping CPU usage reasonable on mobile devices.
            if (now - lastLiveDetectionAt >= 120) {

                lastLiveDetectionAt = now;

                try {

                    const result = liveFaceDetector.detectForVideo(video, now);
                    const detections = result.detections || [];

                    if (detections.length) {

                        noFaceFrames = 0;
                        ensureFaceGuideCount(detections.length);

                        // Draw a separate guide around EVERY detected face.
                        detections.forEach((detection, index) => {
                            moveGuideToFace(
                                detection.boundingBox,
                                faceGuides[index]
                            );
                        });

                        // Hide old guides if fewer faces are detected this frame.
                        hideUnusedFaceGuides(detections.length);

                    } else {

                        noFaceFrames++;

                        // Hide guides after a few missed frames to avoid flicker.
                        if (noFaceFrames >= 3) {
                            resetGuideToSearching();
                        }

                    }

                } catch (trackingError) {

                    console.warn("Live face tracking frame failed:", trackingError);

                }

            }

        }

        requestAnimationFrame(trackingFrame);

    }

    requestAnimationFrame(trackingFrame);

}

function moveGuideToFace(box, targetGuide = guide) {

    if (!box || !targetGuide || !video) return;

    // Only show this guide after a face has actually been detected.
    targetGuide.hidden = false;

    const displayWidth = video.clientWidth;
    const displayHeight = video.clientHeight;
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;

    if (!displayWidth || !displayHeight || !sourceWidth || !sourceHeight) return;

    // Match the video's object-fit: cover crop so the guide aligns with
    // the face as it appears inside the visible square camera preview.
    const scale = Math.max(
        displayWidth / sourceWidth,
        displayHeight / sourceHeight
    );

    const renderedWidth = sourceWidth * scale;
    const renderedHeight = sourceHeight * scale;
    const cropX = (renderedWidth - displayWidth) / 2;
    const cropY = (renderedHeight - displayHeight) / 2;

    let faceLeft = (box.originX * scale) - cropX;
    const faceTop = (box.originY * scale) - cropY;
    const faceWidth = box.width * scale;
    const faceHeight = box.height * scale;

    // If CSS mirrors the video horizontally, mirror the detected X coordinate
    // for the visible preview so the guide stays on the same displayed side.
    const videoTransform = window.getComputedStyle(video).transform;
    if (videoTransform && videoTransform !== "none") {
        try {
            const matrix = new DOMMatrixReadOnly(videoTransform);
            if (matrix.a < 0) faceLeft = displayWidth - faceLeft - faceWidth;
        } catch (_) { /* Keep the normal coordinate mapping if unsupported. */ }
    }


    // Keep the box narrower and shorter, with more room above the hair.
    const guideWidth = Math.min(
        displayWidth * 0.94,
        Math.max(110, faceWidth * 1.55)
    );

    const guideHeight = Math.min(
        displayHeight * 0.94,
        Math.max(140, faceHeight * 1.55)
    );

    const centerX = Math.max(
        guideWidth / 2,
        Math.min(displayWidth - guideWidth / 2, faceLeft + faceWidth / 2)
    );

    // Shift the box slightly upward to add headroom and reduce space below.
    const desiredCenterY =
        faceTop + faceHeight / 2 - faceHeight * 0.20;

    const centerY = Math.max(
        guideHeight / 2,
        Math.min(displayHeight - guideHeight / 2, desiredCenterY)
    );


    targetGuide.style.left = `${video.offsetLeft + centerX}px`;
    targetGuide.style.top = `${video.offsetTop + centerY}px`;
    targetGuide.style.width = `${guideWidth}px`;
    targetGuide.style.height = `${guideHeight}px`;
    targetGuide.classList.add("is-tracking");

}

function resetGuideToSearching() {

    if (!guide) return;

    faceGuides.forEach((faceGuide) => {
        faceGuide.classList.remove("is-tracking");
        faceGuide.hidden = true;
        faceGuide.style.left = "50%";
        faceGuide.style.top = "50%";
        faceGuide.style.width = "190px";
        faceGuide.style.height = "240px";
    });

}

// =====================================
// FACE SIZE TEST
// =====================================

function checkFaceSize(face) {

    if (!face || !face.boundingBox) {

        return {
            ok: false,
            message: "No face"
        };

    }

    const box = face.boundingBox;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    const faceWidthRatio = box.width / canvasWidth;
    const faceHeightRatio = box.height / canvasHeight;

    // Face should not be too small
    if (
        faceWidthRatio < 0.20 ||
        faceHeightRatio < 0.20
    ) {

        return {
            ok: false,
            message: "Face too small"
        };

    }

    // Face should not be too large
    if (
        faceWidthRatio > 0.80 ||
        faceHeightRatio > 0.80
    ) {

        return {
            ok: false,
            message: "Face too large"
        };

    }

    return {
        ok: true,
        message: "Face size OK"
    };

}


// =====================================
// FACE POSITION TEST
// =====================================

function checkFacePosition(face) {

    if (!face || !face.boundingBox) {

        return {
            ok: false,
            message: "No face"
        };

    }

    const box = face.boundingBox;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Center point of detected face
    const faceCenterX =
        box.originX + (box.width / 2);

    const faceCenterY =
        box.originY + (box.height / 2);

    const canvasCenterX =
        canvasWidth / 2;

    const canvasCenterY =
        canvasHeight / 2;

    // Allowed distance from center
    const allowedX =
        canvasWidth * 0.25;

    const allowedY =
        canvasHeight * 0.25;

    const distanceX =
        Math.abs(faceCenterX - canvasCenterX);

    const distanceY =
        Math.abs(faceCenterY - canvasCenterY);

    if (
        distanceX > allowedX ||
        distanceY > allowedY
    ) {

        return {
            ok: false,
            message: "Face not centered"
        };

    }

    return {
        ok: true,
        message: "Face position OK"
    };

}

const video = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const preview = document.getElementById("preview");

const captureBtn = document.getElementById("captureBtn");
const retakeBtn = document.getElementById("retakeBtn");
const useBtn = document.getElementById("useBtn");

captureBtn.disabled = true;
captureBtn.hidden = true;

const controls = document.querySelector(".buttons");

// =====================================
// NATURAL CAMERA FILTERS
// Filters are applied to the live preview and baked into the captured image.
// They adjust light/color only; they do not reshape facial features.
// =====================================
const cameraFilters = {
    original: { label: "Original", css: "none" },
    enhance:  { label: "Enhance",  css: "brightness(1.06) contrast(1.08) saturate(1.04)" },
    bright:   { label: "Bright",   css: "brightness(1.12) contrast(1.03)" },
    natural:  { label: "Natural",  css: "brightness(1.03) saturate(1.06)" },
    vivid:    { label: "Vivid",    css: "saturate(1.22) contrast(1.08) brightness(1.03)" }
};


let activeCameraFilter = "enhance";

function applyCameraFilter(filterKey) {
    if (!cameraFilters[filterKey]) return;

    activeCameraFilter = filterKey;
    video.style.filter = cameraFilters[filterKey].css;
    video.style.webkitFilter = cameraFilters[filterKey].css;

    document.querySelectorAll(".camera-filter-btn").forEach((button) => {
        const selected = button.dataset.filter === filterKey;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
}

function installCameraFilterControls() {
    if (document.getElementById("cameraFilterBar") || !controls || !controls.parentElement) return;

    const style = document.createElement("style");
    style.id = "cameraFilterStyles";
    style.textContent = `
        #cameraFilterBar {
            display:flex; gap:8px; align-items:center; justify-content:flex-start;
            width:100%; max-width:100%; box-sizing:border-box; overflow-x:auto;
            padding:10px 2px 12px; margin:8px 0 4px;
            scrollbar-width:none; -webkit-overflow-scrolling:touch;
        }
        #cameraFilterBar::-webkit-scrollbar { display:none; }
        .camera-filter-btn {
            flex:0 0 auto; min-width:72px; padding:9px 13px;
            border:1px solid rgba(255,255,255,.34); border-radius:999px;
            background:rgba(255,255,255,.10); color:#fff;
            -webkit-backdrop-filter:blur(14px) saturate(150%);
            backdrop-filter:blur(14px) saturate(150%);
            box-shadow:inset 0 1px 1px rgba(255,255,255,.16), 0 3px 10px rgba(0,0,0,.12);
            font:600 13px/1.2 system-ui,-apple-system,sans-serif;
            white-space:nowrap; cursor:pointer; touch-action:manipulation;
            transition:background .18s ease,border-color .18s ease,transform .18s ease;
        }
        .camera-filter-btn.active {
            background:rgba(255,255,255,.27); border-color:rgba(255,255,255,.82);
            box-shadow:inset 0 1px 2px rgba(255,255,255,.35),0 0 0 1px rgba(255,255,255,.10);
        }
        .camera-filter-btn:active { transform:scale(.97); }
        @media (max-width:480px) {
            #cameraFilterBar { gap:7px; }
            .camera-filter-btn { padding:9px 12px; min-width:68px; font-size:12px; }
        }
    `;
    document.head.appendChild(style);

    const bar = document.createElement("div");
    bar.id = "cameraFilterBar";
    bar.setAttribute("aria-label", "Camera filters");
    
    Object.entries(cameraFilters).forEach(([key, filter]) => {
        const button = document.createElement("button");
    
        button.type = "button";
        button.className = "camera-filter-btn";
        button.dataset.filter = key;
        button.setAttribute("aria-pressed", "false");
    
        // Center the filter label consistently
        button.textContent = filter.label;
        button.style.display = "inline-flex";
        button.style.alignItems = "center";
        button.style.justifyContent = "center";
        button.style.textAlign = "center";
        button.style.whiteSpace = "nowrap";
        button.style.boxSizing = "border-box";
        button.style.flexShrink = "0";
        button.style.lineHeight = "1";
    
        button.addEventListener("click", () => {
            applyCameraFilter(key);
        });
    
        bar.appendChild(button);
    });
    
    controls.parentElement.insertBefore(bar, controls);
    applyCameraFilter(activeCameraFilter);
}

installCameraFilterControls();

const guide = document.getElementById("guide");
faceGuides = [guide];
// Keep the face guide hidden until live detection finds a face.
guide.hidden = true;
const status = document.getElementById("status");
const qualityStatus = document.getElementById("qualityStatus");
let audioContext = null;
let captureLocked = false;
let cameraRetry = 0;

// Prevent duplicate verification submissions from the same Camera page.
let uploadInProgress = false;

let loadingInterval = null;

// =====================================
// APPLICATION STATE
// =====================================

const app = {

    stream: null,

    captured: false,

    photoData: "",

    latitude: "",
    longitude: "",
    accuracy: "",
    address: "",

    agent: "",
    zone: "",
    type: "",
    session: "",
    telegramId: ""

};

// ============================
// READ URL PARAMETERS
// ============================

const params = new URLSearchParams(window.location.search);

app.agent = params.get("agent") || "";
app.zone  = params.get("zone")  || "";
app.type  = params.get("type")  || "";
app.session = params.get("session") || "";
app.telegramId = params.get("telegramId") || "";

function startLoadingAnimation() {

    stopLoadingAnimation();

    const frames = [

        "📷 Initializing Camera.",
        "📷 Initializing Camera..",
        "📷 Initializing Camera..."

    ];

    let i = 0;

    status.innerHTML = frames[0];

    loadingInterval = setInterval(function () {

        i = (i + 1) % frames.length;

        status.innerHTML = frames[i];

    }, 400);

}

function stopLoadingAnimation() {

    clearInterval(loadingInterval);

    loadingInterval = null;

}
// ============================
// PHOTO QUALITY STATUS
// ============================

function showQualityChecking() {

    qualityStatus.style.display = "block";

    qualityStatus.innerHTML = `
        <div style="
            font-size:17px;
            font-weight:700;
            margin-bottom:10px;
        ">
            🔍 AI Photo Quality Scan
        </div>

        <div style="
            font-size:14px;
            opacity:.85;
        ">
            Checking image quality...
        </div>
    `;

}
// ============================
// QUALITY PASSED
// ============================

function showQualityPassed() {

    qualityStatus.style.display = "block";

    qualityStatus.innerHTML = `
        <div style="
            font-size:17px;
            font-weight:700;
            color:#22c55e;
            margin-bottom:10px;
        ">
            ✅ Photo Quality Passed
        </div>

        <div style="
            font-size:14px;
            opacity:.85;
        ">
            Your photo is ready for verification.
        </div>
    `;

}

// ============================
// QUALITY FAILED
// ============================

function showQualityFailed(reason) {

    qualityStatus.style.display = "block";

    qualityStatus.innerHTML = `
        <div style="
            font-size:17px;
            font-weight:700;
            color:#ef4444;
            margin-bottom:10px;
        ">
            ❌ Photo Quality Failed
        </div>

        <div style="
            font-size:14px;
            opacity:.9;
        ">
            ${reason}
        </div>
    `;

}
// ============================
// CHECK BRIGHTNESS
// ============================

function checkBrightness() {

    const ctx = canvas.getContext("2d");

    const image = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
    );

    const data = image.data;

    let total = 0;

    for (let i = 0; i < data.length; i += 4) {

        total +=
            (data[i] +
             data[i + 1] +
             data[i + 2]) / 3;

    }

    const brightness =
        total / (data.length / 4);

    return brightness;

}
// ============================
// CHECK BLUR V2
// ============================

function checkBlur() {

const sampleSize = 160;

const tempCanvas = document.createElement("canvas");

tempCanvas.width = sampleSize;
tempCanvas.height = sampleSize;

const tctx = tempCanvas.getContext("2d");

const source = canvas;

// ----- CENTER CROP -----

const cropSize = Math.min(
    source.width,
    source.height
) * 0.60;

const sx = (source.width - cropSize) / 2;

const sy = (source.height - cropSize) / 2;

tctx.drawImage(

    source,

    sx,
    sy,

    cropSize,
    cropSize,

    0,
    0,

    sampleSize,
    sampleSize

);

    const img = tctx.getImageData(
        0,
        0,
        sampleSize,
        sampleSize
    );

    const data = img.data;

    let sum = 0;

    let count = 0;

    for (let y = 1; y < sampleSize - 1; y++) {

        for (let x = 1; x < sampleSize - 1; x++) {

            const center =
                ((y * sampleSize) + x) * 4;

            const left =
                center - 4;

            const right =
                center + 4;

            const top =
                center - sampleSize * 4;

            const bottom =
                center + sampleSize * 4;

            const c =
                (data[center] +
                 data[center+1] +
                 data[center+2]) / 3;

            const l =
                (data[left] +
                 data[left+1] +
                 data[left+2]) / 3;

            const r =
                (data[right] +
                 data[right+1] +
                 data[right+2]) / 3;

            const t =
                (data[top] +
                 data[top+1] +
                 data[top+2]) / 3;

            const b =
                (data[bottom] +
                 data[bottom+1] +
                 data[bottom+2]) / 3;

            const lap =
                (4 * c) - l - r - t - b;

            sum += Math.abs(lap);

            count++;

        }

    }

    return sum / count;

}
// ============================
// CHECK FACE BLUR
// ============================

function checkFaceBlur(face) {

    if (!face || !face.boundingBox) {

        return null;

    }

    const box = face.boundingBox;

    const source = canvas;

    // Add padding around the detected face
    const paddingX = box.width * 0.20;
    const paddingY = box.height * 0.20;

    let sx = box.originX - paddingX;
    let sy = box.originY - paddingY;

    let sw = box.width + (paddingX * 2);
    let sh = box.height + (paddingY * 2);

    // Keep crop inside canvas
    if (sx < 0) {
        sw += sx;
        sx = 0;
    }

    if (sy < 0) {
        sh += sy;
        sy = 0;
    }

    if (sx + sw > source.width) {
        sw = source.width - sx;
    }

    if (sy + sh > source.height) {
        sh = source.height - sy;
    }

    const sampleSize = 160;

    const tempCanvas =
        document.createElement("canvas");

    tempCanvas.width = sampleSize;
    tempCanvas.height = sampleSize;

    const tctx =
        tempCanvas.getContext("2d");

    tctx.drawImage(

        source,

        sx,
        sy,
        sw,
        sh,

        0,
        0,
        sampleSize,
        sampleSize

    );

    const img = tctx.getImageData(
        0,
        0,
        sampleSize,
        sampleSize
    );

    const data = img.data;

    let sum = 0;
    let count = 0;

    for (
        let y = 1;
        y < sampleSize - 1;
        y++
    ) {

        for (
            let x = 1;
            x < sampleSize - 1;
            x++
        ) {

            const center =
                ((y * sampleSize) + x) * 4;

            const left =
                center - 4;

            const right =
                center + 4;

            const top =
                center - sampleSize * 4;

            const bottom =
                center + sampleSize * 4;

            const c =
                (
                    data[center] +
                    data[center + 1] +
                    data[center + 2]
                ) / 3;

            const l =
                (
                    data[left] +
                    data[left + 1] +
                    data[left + 2]
                ) / 3;

            const r =
                (
                    data[right] +
                    data[right + 1] +
                    data[right + 2]
                ) / 3;

            const t =
                (
                    data[top] +
                    data[top + 1] +
                    data[top + 2]
                ) / 3;

            const b =
                (
                    data[bottom] +
                    data[bottom + 1] +
                    data[bottom + 2]
                ) / 3;

            const lap =
                (4 * c) - l - r - t - b;

            sum += Math.abs(lap);

            count++;

        }

    }

    return sum / count;

}
// ============================
// ANALYZE PHOTO QUALITY
// ============================

function analyzePhotoQuality() {

    app.scannerSkipped = false;

    if (!faceDetectorReady || !faceDetector) {

        return {

            pass: false,

            reason:
                "🤖 AI Scanner is still loading.<br><br>" +
                "Please wait a moment and retake your photo."

        };

    }

    // ----------------------------
    // Brightness Check
    // ----------------------------

    const brightness = checkBrightness();

    if (brightness < 35) {

        return {

            pass: false,

            reason:
                "💡 Lighting is too dark.<br><br>Please retake your photo."

        };

    }

    // ----------------------------
    // FACE DETECTION
    // ----------------------------

    let faceResult;

try {

    faceResult = detectFaces();

} catch (err) {

    const msg = (err && err.message) || String(err);

    // WebGL/MediaPipe error sa device na ito: brightness + blur lang
    if (/GLctx|WebGL|texture/i.test(msg)) {

        app.scannerSkipped = true;

        if (checkBlur() < 5) {
            return {
                pass: false,
                reason:
                    "📷 Image is blurry.<br><br>Please hold the camera steady and retake your photo."
            };
        }

        return { pass: true, scannerSkipped: true };
    }

    throw err;
}

if (!faceResult.primaryFace) {

        return {

            pass: false,

            reason:
                "🙂 No face detected.<br><br>Please make sure your face is clearly visible."

        };

    }

    // ----------------------------
    // FACE BLUR CHECK
    // ----------------------------

    const faceBlur =
        checkFaceBlur(faceResult.primaryFace);

    if (faceBlur === null) {

        return {

            pass: false,

            reason:
                "🙂 Unable to verify face quality.<br><br>Please retake your photo."

        };

    }

    // Final threshold
    if (faceBlur < 5) {

        return {

            pass: false,

            reason:
                "📷 Image is blurry.<br><br>Please hold the camera steady and retake your photo."

        };

    }

    // ----------------------------
    // PASSED
    // ----------------------------

    return {

        pass: true,

        brightness: brightness,

        blur: faceBlur,

        facesDetected: faceResult.faces.length

    };

}
// ============================
// START CAMERA
// ============================

async function startCamera() {

    startLoadingAnimation();

    const timeout = setTimeout(function () {

        stopLoadingAnimation();

        if (app.stream) {

            app.stream.getTracks().forEach(track => track.stop());

            app.stream = null;

        }

        status.innerHTML =
        "❌ Camera initialization timed out.<br>Please reopen the camera.";

    },10000);

    try {

        if (app.stream) {
            app.stream.getTracks().forEach(track => track.stop());
            video.srcObject = null;
            app.stream = null;
        }

        app.stream = await navigator.mediaDevices.getUserMedia({

            video: {
                facingMode: "user"
            },

            audio: false

        });

        video.srcObject = app.stream;

        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;

        video.setAttribute("playsinline", "");
        video.setAttribute("webkit-playsinline", "");

        video.onloadedmetadata = async function () {

            try {

                await video.play();

            } catch (err) {

                console.log(err);

            }

        };

        clearTimeout(timeout);

        stopLoadingAnimation();

        cameraRetry = 0;

        // Reset camera state
        captureLocked = false;
        
        cameraReady = true;

        startLiveFaceTracking();
        
        retakeBtn.disabled = false;
        
        setVerifyButton(true);
        
        updateCameraReadyState();
        
        if (!faceDetectorReady) {
        
            status.innerHTML = "🤖 Initializing AI Scanner...";
        
        }

    }

    catch (error) {

        console.error(error);

        clearTimeout(timeout);

        stopLoadingAnimation();

        if (cameraRetry < 1) {

            cameraRetry++;

            status.innerHTML = "🔄 Retrying Camera...";

            setTimeout(startCamera, 1000);

            return;

        }

        status.innerHTML =
        "❌ Unable to access camera.<br>Please reopen the camera.";

    }

}
function playShutterSound() {

    try {

        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        const now = audioContext.currentTime;

        // Main click
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(500, now + 0.05);

        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.start(now);
        osc.stop(now + 0.06);

        // Mechanical click
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();

        osc2.type = "square";
        osc2.frequency.setValueAtTime(260, now + 0.01);

        gain2.gain.setValueAtTime(0.08, now + 0.01);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

        osc2.connect(gain2);
        gain2.connect(audioContext.destination);

        osc2.start(now + 0.01);
        osc2.stop(now + 0.05);

    } catch (err) {

        console.log(err);

    }

}
// ============================
// CAPTURE
// ============================

let captureEventHandled = false;

function handleCaptureButton(event) {

    if (event) {
        event.preventDefault();
    }

    if (captureEventHandled) {
        return;
    }

    if (captureLocked) {
        return;
    }

    if (captureBtn.disabled) {
        return;
    }

    captureEventHandled = true;
    captureLocked = true;

    startCountdown();

    setTimeout(function () {

        captureEventHandled = false;

    }, 500);

}


// iOS / Telegram Mini App
captureBtn.addEventListener(
    "pointerup",
    handleCaptureButton
);


// Touch fallback
captureBtn.addEventListener(
    "touchend",
    handleCaptureButton,
    {
        passive: false
    }
);

async function startCountdown(){

    if (!video.videoWidth || !video.videoHeight) {

        captureLocked = false;

        captureBtn.disabled = false;

        alert("Camera is not ready.");

        return;

    }

    captureBtn.disabled = true;

    const countdown = document.getElementById("countdown");

    countdown.hidden = false;

    status.innerHTML = "📸 Get Ready...";

    for(let i=3;i>=1;i--){

        countdown.textContent=i;

        await new Promise(r=>setTimeout(r,1000));

    }

    countdown.hidden=true;

    if(navigator.vibrate){

        navigator.vibrate(40);

    }

    playShutterSound();

    const flash=document.getElementById("flash");

    flash.classList.add("active");

    setTimeout(function(){

        flash.classList.remove("active");

        capturePhoto();

    },30);

}
function capturePhoto(){

    if (!faceDetectorReady || !faceDetector) {

        console.warn(
            "⚠️ Capture blocked: MediaPipe is still loading."
        );

        status.style.display = "block";

        status.innerHTML =
            "🤖 AI Scanner is still loading...<br><br>" +
            "Please wait a moment before taking your photo.";

        return;

    }

    if (!video.videoWidth || !video.videoHeight) {

        captureLocked = false;

        captureBtn.disabled = false;

        alert("Camera is not ready.");

        return;

    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    // Bake the selected natural light/color filter into the saved photo.
    // Canvas filtering changes pixels only; no facial geometry is altered.
    ctx.filter = cameraFilters[activeCameraFilter]?.css || "none";
    ctx.drawImage(video, 0, 0);
    ctx.filter = "none";

    app.photoData = canvas.toDataURL("image/jpeg", 0.95);

    if (app.stream) {
        app.stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        app.stream = null;
    }

    preview.src = app.photoData;

    preview.hidden = false;
    video.hidden = true;
    hideUnusedFaceGuides(0);

    captureBtn.hidden = true;
    captureBtn.disabled = true;

    retakeBtn.hidden = false;
    useBtn.hidden = false;

    app.captured = true;

// =====================================
// FACE DETECTION TEST
// =====================================

try {

    const faceResult = detectFaces();

console.log(
    "🙂 Faces detected:",
    faceResult.faces.length
);

if (faceResult.primaryFace) {

    const box = faceResult.primaryFace.boundingBox;

    console.log(
        "🎯 Primary face detected:",
        {
            x: Math.round(box.originX),
            y: Math.round(box.originY),
            width: Math.round(box.width),
            height: Math.round(box.height)
        }
    );


    // ================================
    // FACE SIZE TEST
    // ================================

    const sizeResult =
        checkFaceSize(faceResult.primaryFace);

    console.log(
        sizeResult.ok
            ? "📏 Face Size: OK"
            : "📏 Face Size: " + sizeResult.message
    );


    // ================================
    // FACE POSITION TEST
    // ================================

    const positionResult =
        checkFacePosition(faceResult.primaryFace);

    console.log(
        positionResult.ok
            ? "📍 Face Position: OK"
            : "📍 Face Position: " + positionResult.message
    );

// ================================
// FACE BLUR TEST
// ================================

const fullImageBlur = checkBlur();

const faceBlur =
    checkFaceBlur(faceResult.primaryFace);

console.log(
    "📊 Full Image Blur:",
    fullImageBlur.toFixed(2)
);

console.log(
    "🙂 Face Blur:",
    faceBlur !== null
        ? faceBlur.toFixed(2)
        : "N/A"
);


} else {

    console.log(
        "❌ No face detected"
    );

}
}
catch (error) {

    console.error(
        "❌ Face detection test failed:",
        error
    );

}

// Hide status panel habang preview
status.style.display = "none";

showQualityChecking();

// Disable muna habang nagsa-scan
setVerifyButton(false);

// Simulate AI Scan
setTimeout(function () {

    const result = analyzePhotoQuality();

    if (!result.pass) {

        showQualityFailed(result.reason);

        setVerifyButton(false);

    } else {

showQualityPassed();

setVerifyButton(true);

    }

}, 700);

}
// ============================
// RETAKE
// ============================

retakeBtn.onclick = async function () {

    preview.hidden = true;
    video.hidden = false;
    noFaceFrames = 0;
    resetGuideToSearching();

    captureBtn.hidden = false;
    captureBtn.disabled = false;

    captureLocked = false;

    retakeBtn.hidden = true;
    useBtn.hidden = true;

    app.captured = false;
    app.photoData = "";

    preview.src = "";
    applyCameraFilter(activeCameraFilter);

    app.latitude = "";
    app.longitude = "";
    app.accuracy = "";
    app.address = "";
    qualityStatus.style.display = "none";

    status.style.display = "block";

    setVerifyButton(true);

    await startCamera();

};

// ============================
// GET GPS
// ============================

function getGPS() {

    return new Promise(function(resolve, reject){

        if (!navigator.geolocation){

            reject("GPS not supported");
            return;

        }

        navigator.geolocation.getCurrentPosition(

            function(position){

                app.latitude  = position.coords.latitude.toFixed(6);
                app.longitude = position.coords.longitude.toFixed(6);
                app.accuracy  = Math.round(position.coords.accuracy);

                resolve();

            },

            function(error){

                reject(error.message);

            },

            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }

        );

    });

}

// ============================
// GET ADDRESS
// ============================

async function getAddress() {

    if (!app.latitude || !app.longitude) {

        app.address = "GPS not available";
        return;

    }

    try {

        const url =
            "https://nominatim.openstreetmap.org/reverse?format=jsonv2" +
            "&lat=" + app.latitude +
            "&lon=" + app.longitude;

        const response = await fetch(url, {

            headers: {
                "Accept": "application/json"
            }

        });

        const data = await response.json();

        app.address = data.display_name || "Unknown Address";

    }

    catch (error) {

        console.error(error);

        app.address = "Address not available";

    }

}

// ============================
// DRAW MULTILINE TEXT
// ============================

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {

    const words = (text || "").split(" ");

    let line = "";

    for (let i = 0; i < words.length; i++) {

        const testLine = line + words[i] + " ";

        const width = ctx.measureText(testLine).width;

        if (width > maxWidth && i > 0) {

            ctx.fillText(line, x, y);

            line = words[i] + " ";

            y += lineHeight;

        } else {

            line = testLine;

        }

    }

    ctx.fillText(line, x, y);

    return y + lineHeight;

}
// =====================================
// DRAW LIMITED WRAPPED TEXT
// =====================================

function drawWrappedLimitedText(
    ctx,
    text,
    x,
    y,
    maxWidth,
    lineHeight,
    maxLines
) {

    const words = (text || "").split(" ");

    const lines = [];

    let line = "";

    for (let i = 0; i < words.length; i++) {

        const testLine = line + words[i] + " ";

        if (
            ctx.measureText(testLine).width > maxWidth &&
            line !== ""
        ) {

            lines.push(line.trim());

            line = words[i] + " ";

        } else {

            line = testLine;

        }

    }

    lines.push(line.trim());

    if (lines.length > maxLines) {

        lines.length = maxLines;

        while (
            ctx.measureText(lines[maxLines - 1] + "...").width > maxWidth
        ) {

            const arr = lines[maxLines - 1].split(" ");

            arr.pop();

            lines[maxLines - 1] = arr.join(" ");

        }

        lines[maxLines - 1] += "...";

    }

    for (let i = 0; i < lines.length; i++) {

        ctx.fillText(
            lines[i],
            x,
            y
        );

        y += lineHeight;

    }

    return lines.length;

}

// ============================
// COUNT WRAPPED LINES
// ============================

function getWrappedLineCount(ctx, text, maxWidth) {

    const words = (text || "").split(" ");

    let line = "";
    let count = 1;

    for (let i = 0; i < words.length; i++) {

        const test = line + words[i] + " ";

        if (ctx.measureText(test).width > maxWidth && i > 0) {

            count++;
            line = words[i] + " ";

        } else {

            line = test;

        }

    }

    return count;

}
// =====================================
// DRAW TWO COLUMN ROW
// =====================================

function drawInfoRow(
    ctx,
    leftIcon,
    leftText,
    rightIcon,
    rightText,
    y,
    leftX,
    rightX,
    fontSize
){

    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textBaseline = "top";

    ctx.fillText(
        leftIcon + " " + leftText,
        leftX,
        y
    );

    ctx.fillText(
        rightIcon + " " + rightText,
        rightX,
        y
    );

    return y + (fontSize * 1.6);

}
// =====================================
// DRAW SHIELD
// =====================================

function drawShield(ctx, x, y, size) {

    ctx.save();

    ctx.translate(x, y);

    // Shield
    ctx.beginPath();

    ctx.moveTo(size * 0.5, 0);

    ctx.lineTo(size, size * 0.20);

    ctx.lineTo(size * 0.85, size * 0.85);

    ctx.quadraticCurveTo(
        size * 0.50,
        size * 1.25,
        size * 0.15,
        size * 0.85
    );

    ctx.lineTo(0, size * 0.20);

    ctx.closePath();

    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    // Check
    ctx.beginPath();

    ctx.strokeStyle = "#D90429";
    ctx.lineWidth = size * 0.12;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.moveTo(size * 0.28, size * 0.60);
    ctx.lineTo(size * 0.45, size * 0.78);
    ctx.lineTo(size * 0.74, size * 0.38);

    ctx.stroke();

    ctx.restore();

}
// =====================================================
// BUILD WATERMARK V2
// =====================================================

async function buildWatermarkV2() {

    if (!app.photoData) {

        throw new Error("No photo captured.");

    }

    status.innerHTML = "🖼️ Preparing Watermark...";

    return new Promise((resolve, reject) => {

        const img = new Image();

        img.onload = function () {

            canvas.width = img.width;
            canvas.height = img.height;

            const ctx = canvas.getContext("2d");

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";

            // =====================================
            // DRAW PHOTO
            // =====================================

            ctx.drawImage(
                img,
                0,
                0,
                canvas.width,
                canvas.height
            );

            // =====================================
            // DATE / TIME
            // =====================================

            const now = new Date();

            const dateText = now.toLocaleDateString("en-PH", {

                year: "numeric",
                month: "long",
                day: "numeric"

            });

            const timeText = now.toLocaleTimeString("en-PH", {

                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"

            });

 // =====================================
// RESPONSIVE SIZE
// =====================================

const scale = canvas.width / 640;

const cardWidth = Math.min(400, canvas.width * 0.64);

const titleFont = Math.round(18 * scale);

const subtitleFont = Math.round(10 * scale);

const bodyFont = Math.round(14 * scale);

const smallFont = Math.round(12 * scale);

const lineHeight = Math.round(19 * scale);

            // =====================================
            // CARD SIZE
            // =====================================

            const cardHeight = 205;

            const cardX = 3;

            const cardY =
                canvas.height - cardHeight - 3;

            // =====================================
            // ROUNDED GLASS CARD
            // =====================================

            ctx.save();

            ctx.beginPath();

            const radius = 18;

            ctx.moveTo(cardX + radius, cardY);

            ctx.lineTo(cardX + cardWidth - radius, cardY);

            ctx.quadraticCurveTo(
                cardX + cardWidth,
                cardY,
                cardX + cardWidth,
                cardY + radius
            );

            ctx.lineTo(
                cardX + cardWidth,
                cardY + cardHeight - radius
            );

            ctx.quadraticCurveTo(
                cardX + cardWidth,
                cardY + cardHeight,
                cardX + cardWidth - radius,
                cardY + cardHeight
            );

            ctx.lineTo(
                cardX + radius,
                cardY + cardHeight
            );

            ctx.quadraticCurveTo(
                cardX,
                cardY + cardHeight,
                cardX,
                cardY + cardHeight - radius
            );

            ctx.lineTo(
                cardX,
                cardY + radius
            );

            ctx.quadraticCurveTo(
                cardX,
                cardY,
                cardX + radius,
                cardY
            );

            ctx.closePath();

            // 45% opacity
            ctx.fillStyle = "rgba(20,20,20,0.25)";
            ctx.shadowColor = "rgba(0,0,0,.35)";
            ctx.shadowBlur = 18;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 6;

            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.shadowColor = "transparent";

            // White Border
            ctx.strokeStyle = "rgba(255,255,255,.30)";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.restore();

             // =====================================
            // START POSITION
            // =====================================

            let y = cardY + 26;

            const left = cardX + 18;

            const right =
                cardX + cardWidth * 0.55;

            // =====================================
            // HEADER
            // =====================================

            ctx.textBaseline = "top";

            ctx.fillStyle = "#FFFFFF";

            ctx.font = `bold ${titleFont}px Arial`;

            ctx.fillText(
                "RJAB CORPORATION",
                left,
                y
            );

            y += 20;

            ctx.font = `${subtitleFont}px Arial`;

            ctx.fillStyle = "#E5E7EB";

            ctx.fillText(
                "PHOTO VERIFICATION",
                left,
                y
            );

            y += 12;

            // =====================================
            // DIVIDER
            // =====================================

            ctx.strokeStyle = "rgba(255,255,255,.10)";
            ctx.lineWidth = 1;

            ctx.beginPath();

            ctx.moveTo(
                left,
                y
            );

            ctx.lineTo(
                cardX + cardWidth - 18,
                y
            );

            ctx.stroke();

            y += 16;

            // =====================================
            // DATE | TIME
            // =====================================

            ctx.font = `${bodyFont}px Arial`;

            y = drawInfoRow(

                ctx,

                "📅",
                dateText,

                "🕒",
                timeText,

                y,

                left,

                right,

                bodyFont

            );

            // =====================================
// AGENT | ZONE
// =====================================

ctx.font = `${bodyFont}px Arial`;
ctx.fillStyle = "#FFFFFF";
ctx.textBaseline = "top";

// Agent (max 2 lines)
const agentLines = drawWrappedLimitedText(

    ctx,

    "👤 " + (app.agent || "-"),

    left,

    y,

    Math.min(
    cardWidth * 0.48,
    right - left - 20
),

    bodyFont + 3,

    2

);

// Zone (always aligned with Agent first line)

ctx.textAlign = "left";

ctx.fillText(
    "📍 " + (app.zone || "-"),
    right,
    y
);

// Dynamic spacing
y += agentLines * (bodyFont + 3);

            // =====================================
            // TYPE | GPS
            // =====================================

            y = drawInfoRow(

                ctx,

                "📋",
                app.type || "-",

                "🎯",
                "±" + (app.accuracy || "-") + " m",

                y,

                left,

                right,

                bodyFont

            );

            y += 6;

            // =====================================
            // LOCATION TITLE
            // =====================================

            ctx.font = `bold ${bodyFont}px Arial`;
            ctx.fillStyle = "#FFFFFF";

            ctx.fillText(
                "📍 Location",
                left,
                y
            );

            y += lineHeight;

            // =====================================
            // ADDRESS
            // =====================================

            ctx.font = `${smallFont}px Arial`;
            ctx.fillStyle = "#F3F4F6";

            const address = (app.address || "Unknown Address")
                .split(",")
                .slice(0, 5)
                .join(", ");

            y = drawWrappedText(
                ctx,
                address,
                left,
                y,
                cardWidth - 36,
                15
            );

            y += 10;

            // =====================================
            // FOOTER
            // =====================================

            const footerHeight = 22;

            ctx.fillStyle = "#D90429";

            ctx.beginPath();

            ctx.moveTo(cardX, cardY + cardHeight - footerHeight);

            ctx.lineTo(cardX + cardWidth, cardY + cardHeight - footerHeight);

            ctx.lineTo(cardX + cardWidth, cardY + cardHeight - 18);

            ctx.quadraticCurveTo(
                cardX + cardWidth,
                cardY + cardHeight,
                cardX + cardWidth - 18,
                cardY + cardHeight
            );

            ctx.lineTo(
                cardX + 18,
                cardY + cardHeight
            );

            ctx.quadraticCurveTo(
                cardX,
                cardY + cardHeight,
                cardX,
                cardY + cardHeight - 18
            );

            ctx.closePath();

            ctx.fill();

            ctx.fillStyle = "#FFFFFF";
            ctx.textBaseline = "middle";

            // =====================================
            // FOOTER CONTENT
            // =====================================

            const footerText = "VERIFIED USING RJAB CAMERA SYSTEM";

            ctx.font = "bold 9px Arial";

            // Sukatin ang text
            const textWidth = ctx.measureText(footerText).width;

            // Shield size
            const shieldSize = 14;

            // Space sa pagitan
            const gap = 10;

            // Total width ng shield + gap + text
            const totalWidth =
                shieldSize +
                gap +
                textWidth;

            // Simula ng group
            const startX =
                cardX + (cardWidth - totalWidth) / 2;

            // Vertical center
            const centerY =
                cardY + cardHeight - (footerHeight / 2);

            drawShield(
                ctx,
                startX,
                centerY - (shieldSize / 2) + 1,
                shieldSize
            );
            ctx.fillStyle = "#FFFFFF";

            ctx.font = "bold 9px Arial";

            ctx.textAlign = "left";
            ctx.textBaseline = "middle";

            ctx.fillText(
                footerText,
                startX + shieldSize + gap,
                centerY
            );

            // Restore defaults
            ctx.textAlign = "left";
            ctx.textBaseline = "top";

            // =====================================
            // EXPORT
            // =====================================

            app.photoData = canvas.toDataURL(
                "image/jpeg",
                0.95
            );

            preview.src = app.photoData;

            resolve();

        };

        img.onerror = function () {

            reject("Unable to load image.");

        };

        img.src = app.photoData;

    });

}
// ============================
// BUILD WATERMARK
// ============================

async function buildWatermark() {

    if (!app.photoData) {
        throw new Error("No photo captured.");
    }

    status.innerHTML = "🖼️ Preparing Watermark...";

    return new Promise((resolve, reject) => {

        const img = new Image();

        img.onload = function () {

            // =====================================
            // LAYOUT CONFIGURATION
            // =====================================

            const layout = {

                labelX: 25,
                valueX: 180,

                titleTop: 38,
                subtitleTop: 88,

                dividerTop: 125,

                startY: 145,

                rowHeight: 36,

                locationGap: 44,

                addressLineHeight: 28,

                verificationGap: 30

            };

            // =====================================
            // MEASURE ADDRESS
            // =====================================

            const measureCanvas = document.createElement("canvas");
            const measureCtx = measureCanvas.getContext("2d");

            measureCtx.font = "bold 19px Arial";

            const addressLines = getWrappedLineCount(
                measureCtx,
                app.address || "",
                img.width - layout.valueX - 25
            );

            const fixedContent =
    layout.startY +
    (layout.rowHeight * 6) +
    layout.locationGap;

         const footerHeight =
    fixedContent +
    (addressLines * layout.addressLineHeight) +
    layout.verificationGap +
    70;

            canvas.width = img.width;
            canvas.height = img.height + footerHeight;

            const ctx = canvas.getContext("2d");

            ctx.textBaseline = "top";

            ctx.font = "20px Arial";

                        const now = new Date();

            const dateText = now.toLocaleDateString("en-PH", {
                year: "numeric",
                month: "long",
                day: "numeric"
            });

            const timeText = now.toLocaleTimeString("en-PH", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            });

            // =====================================
            // DRAW PHOTO
            // =====================================

            ctx.drawImage(img, 0, 0);

            // =====================================
            // PREMIUM BACKGROUND
            // =====================================

            const gradient = ctx.createLinearGradient(
                0,
                img.height,
                0,
                canvas.height
            );

            gradient.addColorStop(0.00, "#120000");
            gradient.addColorStop(0.25, "#2A0000");
            gradient.addColorStop(0.55, "#4D0000");
            gradient.addColorStop(1.00, "#7D0000");

            ctx.fillStyle = gradient;

            ctx.fillRect(
                0,
                img.height,
                canvas.width,
                footerHeight
            );

            // =====================================
            // TOP ACCENT
            // =====================================

            ctx.fillStyle = "#FF3B3B";

            ctx.fillRect(
                0,
                img.height,
                canvas.width,
                5
            );

            // =====================================
            // HEADER
            // =====================================

            ctx.textAlign = "center";

            ctx.fillStyle = "#FFFFFF";
            ctx.font = "bold 40px Arial";

            ctx.fillText(
                "RJAB CORPORATION",
                canvas.width / 2,
                img.height + layout.titleTop
            );

            ctx.fillStyle = "#F8D7DA";
            ctx.font = "bold 24px Arial";

            ctx.fillText(
                "PHOTO VERIFICATION",
                canvas.width / 2,
                img.height + layout.subtitleTop
            );

            // =====================================
            // DIVIDER
            // =====================================

            ctx.strokeStyle = "#FF4A4A";
            ctx.lineWidth = 2;

            ctx.beginPath();

            ctx.moveTo(
                30,
                img.height + layout.dividerTop
            );

            ctx.lineTo(
                canvas.width - 30,
                img.height + layout.dividerTop
            );

            ctx.stroke();

            ctx.textAlign = "left";

            let y = img.height + layout.startY;

                        // =====================================
            // INFORMATION TABLE
            // =====================================

            function drawRow(label, value) {

                ctx.fillStyle = "#FFDCDC";
                ctx.font = "19px Arial";

                ctx.fillText(
                    label,
                    layout.labelX,
                    y
                );

                ctx.fillStyle = "#FFFFFF";
                ctx.font = "bold 19px Arial";

                ctx.fillText(
    ": " + (value || "-"),
    layout.valueX,
    y
);

                y += layout.rowHeight;

            }

            drawRow("Date", dateText);
            drawRow("Time", timeText);
            drawRow("Type", app.type);
            drawRow("Agent", app.agent);
            drawRow("Zone", app.zone);
            drawRow("Accuracy", "±" + app.accuracy + " m");

            y += 8;

            // =====================================
            // LOCATION
            // =====================================

            ctx.fillStyle = "#FFDCDC";
            ctx.font = "19px Arial";

            ctx.fillText(
    "Location",
    layout.labelX,
    y + 2
);

            ctx.fillStyle = "#FFFFFF";
            ctx.font = "bold 19px Arial";

            y = drawWrappedText(

                ctx,

                ": " + (app.address || "Unknown Address"),

                layout.valueX,

                y,

                canvas.width - layout.valueX - 25,

                layout.addressLineHeight

            );
            // Bottom padding bago ang footer
            y += 12;

             // =====================================
            // VERIFICATION FOOTER
            // =====================================

            y += layout.verificationGap;

            ctx.strokeStyle = "rgba(255,255,255,0.25)";
            ctx.lineWidth = 1;

            ctx.beginPath();

            ctx.moveTo(
                25,
                y
            );

            ctx.lineTo(
                canvas.width - 25,
                y
            );

            ctx.stroke();

            y += 25;

            ctx.textAlign = "center";

// Verification Text
ctx.fillStyle = "#FFDCDC";
ctx.font = "bold 16px Arial";

ctx.fillText(
    "VERIFIED USING RJAB CORPORATION CAMERA SYSTEM",
    canvas.width / 2,
    y
);

// =====================================
// COPYRIGHT
// =====================================

const currentYear = new Date().getFullYear();

ctx.fillStyle = "rgba(255,255,255,0.55)";
ctx.font = "13px Arial";

ctx.fillText(
    "© " + currentYear + " RJAB CORPORATION",
    canvas.width / 2,
    y + 22
);

            // =====================================
            // EXPORT IMAGE
            // =====================================

            app.photoData = canvas.toDataURL(
                "image/jpeg",
                0.95
            );

            preview.src = app.photoData;

            resolve();

        };

        img.onerror = function () {

            reject("Unable to load image.");

        };

        img.src = app.photoData;

    });

}

// =====================================================
// CLOSE TELEGRAM MINI APP  (NEW)
// =====================================================

function closeMiniApp() {

    const tg = window.Telegram && window.Telegram.WebApp;

    if (!tg) {
        console.warn("Telegram SDK not loaded.");
        status.innerHTML +=
            "<div style='margin-top:10px;color:#f59e0b'>" +
            "⚠️ Telegram SDK not loaded. You may close this page manually." +
            "</div>";
        return;
    }

    try {
        tg.ready();
        tg.close();
    } catch (err) {
        console.error("Mini App close error:", err);
        status.innerHTML +=
            "<div style='margin-top:10px;color:#ef4444'>" +
            "❌ Unable to close: " + err.message +
            "</div>";
    }
}

// ============================
// TEST API CONNECTION
// ============================

async function uploadPhoto() {

    if (uploadInProgress) {
        console.log("📸 Upload already in progress. Duplicate request blocked.");
        return;
    }

    uploadInProgress = true;
    setVerifyButton(false);

    status.innerHTML = "☁️ Uploading...";

const payload = {

    telegramId: app.telegramId || "",

    agent: app.agent || "",

    zone: app.zone || "",
    type: app.type || "",
    session: app.session || "",

    latitude: app.latitude || "",
    longitude: app.longitude || "",
    accuracy: app.accuracy || "",
    address: app.address || "",

    scanner: app.scannerSkipped ? "skipped" : "ok",

    photo: app.photoData || ""

};

    const response = await fetch(
        "https://script.google.com/macros/s/AKfycbxBG07t1L2yesxkIqE-lQZMorEo0vfcKY8WZrrv17PlZPw50NtXvzrRkTkQDn4JPVG7bg/exec",
        {
            method: "POST",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(payload)
        }
    );
    if (!response.ok) {
    throw new Error("Server Error (" + response.status + ")");
}

    let result;

try {

    result = await response.json();

} catch {

    throw new Error("Invalid server response.");

}

if (!result.success) {
    throw new Error(result.error || "Upload failed.");
}

if (result.alreadyProcessed) {
    console.log("📸 ACTCHECK camera was already processed. Closing Camera safely.");
}

// Success message
status.innerHTML =
`
<div style="color:#22c55e;font-weight:bold;font-size:20px">
✅ Verification Complete
</div>

<div style="margin-top:10px">
Returning to Telegram...
</div>
`;
// Lock the preview
preview.style.opacity = "0.9";
preview.style.pointerEvents = "none";
captureBtn.disabled = true;
retakeBtn.disabled = true;
useBtn.disabled = true;
document.querySelector(".buttons").style.display = "none";

// Make sure camera is hidden
video.hidden = true;

// Hide the guide overlay
guide.hidden = true;

// =================================================
// AUTO-CLOSE TELEGRAM MINI APP  (UPDATED)
// =================================================

app.photoData = "";
preview.src = "";

setTimeout(closeMiniApp, 1000);

}
// ============================
// VERIFY BUTTON STATE
// ============================

function setVerifyButton(enabled) {

    useBtn.disabled = !enabled;

    useBtn.style.opacity = enabled ? "1" : "0.35";

    useBtn.style.pointerEvents = enabled ? "auto" : "none";

}
// ============================
// USE PHOTO
// ============================

useBtn.onclick = async function () {

    if (uploadInProgress) {
        console.log("📸 Verification already in progress. Duplicate click blocked.");
        return;
    }

    setVerifyButton(false);

    controls.style.display = "none";

    // Hide Photo Quality Panel
    qualityStatus.style.display = "none";

    // Show Processing Panel
    status.style.display = "block";

    status.innerHTML = "📍 Getting GPS...";

    try {

        await getGPS();

        status.innerHTML = "🌍 Getting Address...";

        await getAddress();

        await buildWatermarkV2();

        await uploadPhoto();

    }

    catch (error) {

    console.error(error);

    uploadInProgress = false;

    alert("Operation Failed\n\n" + error);

    status.innerHTML = "❌ Operation Failed";

    // Unlock everything
    captureLocked = false;

    captureBtn.disabled = false;
    retakeBtn.disabled = false;

    setVerifyButton(true);

    controls.style.display = "flex";

    qualityStatus.style.display = "block";

    // Restore the correct status after 2 seconds
    setTimeout(function () {

        if (app.captured) {

            status.innerHTML = "📸 Ready to Upload";

        } else {

            status.innerHTML = "✅ Camera Ready";

        }

    }, 2000);

}

};

// ============================
// START
// ============================

// ============================
// TELEGRAM MINI APP VIEWPORT
// ============================

(function initTelegramViewport() {

    const tg = window.Telegram && window.Telegram.WebApp;

    if (!tg) return;

    try {

        tg.ready();

        // Use the full height of the Mini App
        tg.expand();

        // Prevent swipe-down from closing the app mid-capture
        if (tg.disableVerticalSwipes) {
            tg.disableVerticalSwipes();
        }

    } catch (err) {

        console.warn("Telegram viewport init failed:", err);

    }

})();

initFaceDetector();

startCamera();
