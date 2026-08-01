const video = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const preview = document.getElementById("preview");

const captureBtn = document.getElementById("captureBtn");
const retakeBtn = document.getElementById("retakeBtn");
const useBtn = document.getElementById("useBtn");

const controls = document.querySelector(".buttons");

const guide = document.getElementById("guide");
const status = document.getElementById("status");
let audioContext = null;
let captureLocked = false;
let cameraRetry = 0;

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

        video.setAttribute("playsinline", true);

        await video.play();

		clearTimeout(timeout);

stopLoadingAnimation();

cameraRetry = 0;

// Reset camera state
captureLocked = false;

captureBtn.disabled = false;
retakeBtn.disabled = false;
useBtn.disabled = false;

status.innerHTML = "✅ Camera Ready";

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

captureBtn.onclick = function () {

    if (captureLocked) {

        return;

    }

    captureLocked = true;

    startCountdown();

};

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

    if (!video.videoWidth || !video.videoHeight) {

    captureLocked = false;

    captureBtn.disabled = false;

    alert("Camera is not ready.");

    return;

}

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    ctx.drawImage(video, 0, 0);

    app.photoData = canvas.toDataURL("image/jpeg", 0.95);

    if (app.stream) {
        app.stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        app.stream = null;
    }

    preview.src = app.photoData;

    preview.hidden = false;
    video.hidden = true;
    guide.hidden = true;

    captureBtn.hidden = true;
	captureBtn.disabled = true;
	
    retakeBtn.hidden = false;
    useBtn.hidden = false;

    app.captured = true;

    status.innerHTML = "📸 Preview";

}
// ============================
// RETAKE
// ============================

retakeBtn.onclick = async function () {

	preview.hidden = true;
    video.hidden = false;
    guide.hidden = false;

    captureBtn.hidden = false;
	captureBtn.disabled = false;

	captureLocked = false;
	
    retakeBtn.hidden = true;
    useBtn.hidden = true;

    app.captured = false;
    app.photoData = "";

	preview.src = "";

    app.latitude = "";
    app.longitude = "";
    app.accuracy = "";
    app.address = "";
	
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

// =====================================================
// BUILD WATERMARK V2
// =====================================================

async function buildWatermark() {

    if (!app.photoData) {
        throw new Error("No photo captured.");
    }

    status.innerHTML = "🖼️ Preparing Watermark...";

    return new Promise((resolve, reject) => {

        const img = new Image();

        img.onload = function () {

            // =====================================
            // CANVAS
            // =====================================

            canvas.width = img.width;
            canvas.height = img.height;

            const ctx = canvas.getContext("2d");

            ctx.textBaseline = "top";

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


            const dayText = now.toLocaleDateString("en-PH", {

                weekday: "short"

            });

            // =====================================
            // SMART CENTER CROP
            // =====================================

        ctx.drawImage(
    	img,
    	0,
    	0,
    	img.width,
    	img.height,
    	0,
    	0,
   	 	canvas.width,
    	canvas.height
);
// =====================================
// RESPONSIVE LAYOUT ENGINE
// =====================================

// Fonts
const titleSize = Math.round(canvas.width * 0.030);
const subSize   = Math.round(canvas.width * 0.018);
const bodySize  = Math.max(Math.round(canvas.width * 0.018), 13);
ctx.font = `${bodySize}px Arial`;
ctx.fillStyle = "#FFFFFF";

const rows = [

    [
        "📅 " + dateText,
        "🕒 " + timeText
    ],

    [
        "📆 " + dayText,
        "📍 " + (app.zone || "-")
    ],

    [
        "👤 " + (app.agent || "-"),
        "📋 " + (app.type || "-")
    ],

    [
        "🎯 Accuracy : ±" + (app.accuracy || "-") + " m",
        ""
    ]

];

// Spacing
const padding = Math.round(canvas.width * 0.03);
			
const lineHeight = Math.round(bodySize * 1.45);

// Layout Constants
const TITLE_GAP = 6;
const SUBTITLE_GAP = 12;
const DIVIDER_GAP = 18;

const SMALL_DIVIDER_TOP = Math.round(bodySize * 0.5);
const SMALL_DIVIDER_BOTTOM = Math.round(bodySize * 1.2);

const LOCATION_BOTTOM = Math.round(lineHeight * 0.30);

// Available width for wrapped address
const maxWidth = canvas.width - (padding * 2);

// Prepare font for measuring
ctx.font = `${Math.max(bodySize - 2, 12)}px Arial`;

// Count wrapped address lines
const addressText =
    app.address || "Unknown Address";

const addressLines =
    getWrappedLineCount(

        ctx,

        addressText,

        maxWidth

    );

// =====================================
// TRUE AUTO HEIGHT ENGINE
// =====================================

const topPadding = padding;

const bottomPadding = padding;

// Actual content height

let contentHeight = 0;

// Header

contentHeight += titleSize;
contentHeight += TITLE_GAP;

contentHeight += subSize;
contentHeight += SUBTITLE_GAP;

// Divider

contentHeight += DIVIDER_GAP;

// Information Grid

contentHeight += rows.length * lineHeight;

// Small Divider

contentHeight += SMALL_DIVIDER_TOP;

contentHeight += SMALL_DIVIDER_BOTTOM;

// Location Title

contentHeight += lineHeight;

// Wrapped Address

contentHeight += addressLines * lineHeight;

// Bottom breathing space

contentHeight += LOCATION_BOTTOM;

// Final Panel Height

const panelHeight =

    topPadding +

    contentHeight +

    bottomPadding;
// Automatic panel position
const panelY = Math.max(

    canvas.height - panelHeight,

    canvas.height * 0.58

);
			
	            // =====================================
            // PREMIUM OVERLAY PANEL
            // =====================================

            ctx.save();

            // Semi-transparent background
            ctx.fillStyle = "rgba(0,0,0,0.45)";

            ctx.fillRect(

                0,

                panelY,

                canvas.width,

                panelHeight

            );

            // =====================================
            // RED ACCENT LINE
            // =====================================

            ctx.fillStyle = "#C8102E";
const accentHeight = Math.max(
    4,
    Math.round(bodySize * 0.35)
);
			
            ctx.fillRect(

                0,

                panelY,

                canvas.width,

                accentHeight

            );

// =====================================
// DYNAMIC HEADER LAYOUT
// =====================================

let y = panelY + topPadding;

// ---------- HEADER ----------

ctx.fillStyle = "#FFFFFF";

ctx.font = `bold ${titleSize}px Arial`;

ctx.fillText(

    "RJAB CORPORATION",

    padding,

    y

);

y += titleSize + TITLE_GAP;

// ---------- SUBTITLE ----------

ctx.fillStyle = "#E6E6E6";

ctx.font = `${subSize}px Arial`;

ctx.fillText(

    "PHOTO VERIFICATION",

    padding,

    y

);

y += subSize + SUBTITLE_GAP;

// ---------- DIVIDER ----------

ctx.strokeStyle = "rgba(255,255,255,0.18)";

ctx.lineWidth = 2;

ctx.beginPath();

ctx.moveTo(

    padding,

    y

);

ctx.lineTo(

    canvas.width - padding,

    y

);

ctx.stroke();

y += DIVIDER_GAP;

// ---------- COLUMNS ----------

const leftColumnX = padding;

const rightColumnX = Math.round(canvas.width * 0.56);       

rows.forEach(function(row){

    ctx.fillText(

        row[0],

        leftColumnX,

        y

    );

    if(row[1]){

        ctx.fillText(

            row[1],

            rightColumnX,

            y

        );

    }

    y += lineHeight;

});
            // =====================================
            // SMALL DIVIDER
            // =====================================

            y += SMALL_DIVIDER_TOP;

            ctx.strokeStyle = "rgba(255,255,255,0.15)";

            ctx.lineWidth = 1;

            ctx.beginPath();

            ctx.moveTo(

                padding,

                y

            );

            ctx.lineTo(

                canvas.width - padding,

                y

            );

            ctx.stroke();

            y += SMALL_DIVIDER_BOTTOM;

// =====================================
// LOCATION (AUTO-FIT)
// =====================================

ctx.fillStyle = "#FFFFFF";
ctx.font = `bold ${bodySize}px Arial`;

ctx.fillText(

    "📍 Location",

    padding,

    y

);

y += lineHeight;

ctx.font = `${Math.max(bodySize - 2, 12)}px Arial`;

ctx.fillStyle = "#F5F5F5";

// Draw wrapped address

y = drawWrappedText(

    ctx,

    addressText,

    padding,

    y,

    maxWidth,

    lineHeight

);
// Bottom spacing

y += LOCATION_BOTTOM;
			
// =====================================
// PREMIUM VERIFICATION BAR
// =====================================

// Dynamic bar height
const barHeight = Math.max(

    Math.round(bodySize * 1.8),

    22

);

// Always attach to bottom
const barY = canvas.height - barHeight;

// Background
ctx.fillStyle = "#C8102E";

ctx.fillRect(

    0,

    barY,

    canvas.width,

    barHeight

);

// Text
ctx.fillStyle = "#FFFFFF";

ctx.font = `bold ${Math.max(bodySize - 1, 12)}px Arial`;

ctx.textAlign = "center";

ctx.textBaseline = "middle";

ctx.fillText(

    "✔ VERIFIED USING RJAB CAMERA SYSTEM",

    canvas.width / 2,

    barY + (barHeight / 2)

);

// Restore defaults
ctx.textAlign = "left";
ctx.textBaseline = "top";

ctx.restore();

            // =====================================
            // EXPORT JPEG
            // =====================================

            app.photoData = canvas.toDataURL(

                "image/jpeg",

                0.95

            );

            preview.src = app.photoData;

            resolve();

        };

        // =====================================
        // IMAGE LOAD ERROR
        // =====================================

        img.onerror = function () {

            reject("Unable to load image.");

        };

        img.src = app.photoData;

    });

}
// ============================
// TEST API CONNECTION
// ============================

async function uploadPhoto() {

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

// Auto-close if opened inside Telegram
try {

    if (
        window.Telegram &&
        Telegram.WebApp
    ) {

        Telegram.WebApp.ready();

		app.photoData = "";
		preview.src = "";

        setTimeout(function () {

		Telegram.WebApp.close();

        }, 2000);

    }

} catch (err) {

    console.log("Telegram WebApp close not available.");

}
}
// ============================
// USE PHOTO
// ============================

useBtn.onclick = async function () {

    useBtn.disabled = true;
	
	controls.style.display = "none";

    status.innerHTML = "📍 Getting GPS...";

    try {

        await getGPS();

        status.innerHTML = "🌍 Getting Address...";

        await getAddress();

        await buildWatermark();

await uploadPhoto();

    }

    catch (error) {

    console.error(error);

    alert("Operation Failed\n\n" + error);

    status.innerHTML = "❌ Operation Failed";

    // Unlock everything
    captureLocked = false;

    captureBtn.disabled = false;
    retakeBtn.disabled = false;
    useBtn.disabled = false;
		
	controls.style.display = "flex";

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

startCamera();
