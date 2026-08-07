const video = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const preview = document.getElementById("preview");

const captureBtn = document.getElementById("captureBtn");
const retakeBtn = document.getElementById("retakeBtn");
const useBtn = document.getElementById("useBtn");

const controls = document.querySelector(".buttons");

const guide = document.getElementById("guide");
const status = document.getElementById("status");
const qualityStatus = document.getElementById("qualityStatus");
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
// CHECK BLUR
// ============================

function checkBlur() {

    const ctx = canvas.getContext("2d");

    const image = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
    );

    const data = image.data;

    let edgeTotal = 0;

    let pixels = 0;

    for (let y = 0; y < canvas.height - 1; y++) {

        for (let x = 0; x < canvas.width - 1; x++) {

            const i = (y * canvas.width + x) * 4;

            const gray1 =
                (data[i] +
                 data[i + 1] +
                 data[i + 2]) / 3;

            const gray2 =
                (data[i + 4] +
                 data[i + 5] +
                 data[i + 6]) / 3;

            edgeTotal += Math.abs(gray1 - gray2);

            pixels++;

        }

    }

    return edgeTotal / pixels;

}
// ============================
// ANALYZE PHOTO QUALITY
// ============================

function analyzePhotoQuality() {

    const brightness = checkBrightness();
    const blur = checkBlur();

    return {

        pass: true,

        reason:
            "Brightness : " + brightness.toFixed(0) +
            "<br>Blur Score : " + blur.toFixed(1)

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

captureBtn.disabled = false;
retakeBtn.disabled = false;

setVerifyButton(true);

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
line-height:1.8;
">
${result.reason}
</div>
`;

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

startCamera();
