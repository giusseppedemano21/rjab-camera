const video = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const preview = document.getElementById("preview");

const captureBtn = document.getElementById("captureBtn");
const retakeBtn = document.getElementById("retakeBtn");
const useBtn = document.getElementById("useBtn");

const guide = document.getElementById("guide");
const status = document.getElementById("status");

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

// ============================
// START CAMERA
// ============================

async function startCamera() {

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

        status.innerHTML = "✅ Camera Ready";

    }

    catch (error) {

        console.error(error);

        status.innerHTML = "❌ Camera Access Denied";

    }

}
// ============================
// CAPTURE
// ============================

captureBtn.onclick = function () {

    if (!video.videoWidth || !video.videoHeight) {

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
    retakeBtn.hidden = false;
    useBtn.hidden = false;

    app.captured = true;

    status.innerHTML = "📸 Preview";

};
// ============================
// RETAKE
// ============================

retakeBtn.onclick = async function () {

    preview.hidden = true;
    video.hidden = false;
    guide.hidden = false;

    captureBtn.hidden = false;
    retakeBtn.hidden = true;
    useBtn.hidden = true;

    app.captured = false;
    app.photoData = "";

    app.latitude = "";
    app.longitude = "";
    app.accuracy = "";
    app.address = "";

    status.innerHTML = "✅ Camera Ready";

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

            const cropPercent = 0.90;

            const cropWidth = img.width * cropPercent;
            const cropHeight = img.height * cropPercent;

            const sourceX = (img.width - cropWidth) / 2;
            const sourceY = (img.height - cropHeight) / 2;

            ctx.drawImage(

                img,

                sourceX,
                sourceY,

                cropWidth,
                cropHeight,

                0,
                0,

                canvas.width,
                canvas.height

            );

            // =====================================
// OVERLAY PANEL SETTINGS
// =====================================

const panelHeight = Math.round(canvas.height * 0.32);

const panelY = canvas.height - panelHeight;

// =====================================
// RESPONSIVE FONT SIZES
// =====================================

const titleSize = Math.round(canvas.width * 0.030);

const subSize = Math.round(canvas.width * 0.018);

const bodySize = Math.round(canvas.width * 0.016);

// =====================================
// RESPONSIVE SPACING
// =====================================

const padding = Math.round(canvas.width * 0.03);

const lineHeight = Math.round(bodySize * 1.45);

	            // =====================================
            // PREMIUM OVERLAY PANEL
            // =====================================

            ctx.save();

            // Semi-transparent background
            ctx.fillStyle = "rgba(0,0,0,0.40)";

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

            ctx.fillRect(

                0,

                panelY,

                canvas.width,

                6

            );

            // =====================================
// HEADER
// =====================================

// Responsive header positions
const headerY = panelY + Math.round(panelHeight * 0.08);

const subtitleY = headerY + titleSize + Math.round(panelHeight * 0.02);

ctx.fillStyle = "#FFFFFF";

ctx.font = `bold ${titleSize}px Arial`;

ctx.fillText(

    "RJAB CORPORATION",

    padding,

    headerY

);

ctx.fillStyle = "#E6E6E6";

ctx.font = `${subSize}px Arial`;

ctx.fillText(

    "PHOTO VERIFICATION",

    padding,

    subtitleY

);

            // =====================================
            // HEADER DIVIDER
            // =====================================

            ctx.strokeStyle = "rgba(255,255,255,0.18)";

            ctx.lineWidth = 2;

            ctx.beginPath();

            const dividerY = subtitleY + subSize + Math.round(panelHeight * 0.04);

ctx.moveTo(

    padding,

    dividerY

);

ctx.lineTo(

    canvas.width - padding,

    dividerY

);

ctx.stroke();

let y = dividerY + Math.round(panelHeight * 0.05);

const leftColumnX = padding;

const rightColumnX = Math.round(canvas.width * 0.55);
           
            // =====================================
            // INFORMATION ROWS
            // =====================================

            function drawRow(leftText, rightText) {

    ctx.font = `${bodySize}px Arial`;
    ctx.fillStyle = "#FFFFFF";

    ctx.fillText(

        leftText,

        leftColumnX,

        y

    );

    ctx.fillText(

        rightText,

        rightColumnX,

        y

    );

    y += lineHeight;

}

            drawRow(

                "📅 " + dateText,

                "🕒 " + timeText + "   📆 " + dayText

            );

            drawRow(

                "👤 " + (app.agent || "-"),

                "📍 " + (app.zone || "-")

            );

            drawRow(

                "📋 " + (app.type || "-"),

                "🎯 ±" + (app.accuracy || "-") + " m"

            );

            // =====================================
            // SMALL DIVIDER
            // =====================================

            y += Math.round(bodySize * 0.5);

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

            y += Math.round(bodySize * 1.2);

	            // =====================================
            // LOCATION
            // =====================================

            ctx.fillStyle = "#FFFFFF";
            ctx.font = `bold ${bodySize}px Arial`;

            ctx.fillText(

                "📍 Location",

                padding,

                y

            );

            y += Math.round(bodySize * 1.8);

            ctx.font = `${Math.max(bodySize - 2, 12)}px Arial`;
            ctx.fillStyle = "#F5F5F5";

            const maxWidth = canvas.width - (padding * 2);

            const words = (app.address || "Unknown Address").split(" ");

            let line = "";

            for (let i = 0; i < words.length; i++) {

                const testLine = line + words[i] + " ";

                if (ctx.measureText(testLine).width > maxWidth && i > 0) {

                    ctx.fillText(
                        line,
                        padding,
                        y
                    );

                    line = words[i] + " ";

                    y += Math.round(bodySize * 1.4);

                } else {

                    line = testLine;

                }

            }

            ctx.fillText(

                line,

                padding,

                y

            );
	y += Math.round(bodySize * 0.8);
            // =====================================
            // VERIFICATION BAR
            // =====================================

            const barHeight = Math.round(canvas.height * 0.020);

            ctx.fillStyle = "#C8102E";

            ctx.fillRect(

                0,

                canvas.height - barHeight,

                canvas.width,

                barHeight

            );

            ctx.fillStyle = "#FFFFFF";

            ctx.font = `bold ${bodySize}px Arial`;

            ctx.textAlign = "center";

            const barTextY =
    canvas.height - barHeight + Math.round((barHeight - bodySize) / 2);

ctx.fillText(

    "✔ VERIFIED USING RJAB CAMERA SYSTEM",

    canvas.width / 2,

    barTextY

);

            ctx.textAlign = "left";

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

    const result = await response.json();

if (!result.success) {
    throw new Error(result.error || "Upload failed.");
}

// Hide buttons
captureBtn.hidden = true;
retakeBtn.hidden = true;
useBtn.hidden = true;

// Success message
status.innerHTML =
`
<div style="color:#22c55e;font-weight:bold;font-size:20px">
✅ Upload Successful
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

        setTimeout(function () {

            Telegram.WebApp.close();

        }, 1500);

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

    status.innerHTML = "📍 Getting GPS...";

    try {

        await getGPS();

        status.innerHTML = "🌍 Getting Address...";

        await getAddress();

        await buildWatermark();

status.innerHTML="☁️ Uploading...";

await uploadPhoto();

    }

    catch (error) {

    console.error(error);

    alert("Operation Failed\n\n" + error);

    status.innerHTML = "❌ Operation Failed";

    useBtn.disabled = false;

}
   
};

// ============================
// START
// ============================

startCamera();
