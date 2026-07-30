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
    type: ""

};

// ============================
// READ URL PARAMETERS
// ============================

const params = new URLSearchParams(window.location.search);

app.agent = params.get("agent") || "";
app.zone  = params.get("zone")  || "";
app.type  = params.get("type")  || "";

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
                y
            );

            ctx.fillStyle = "#FFFFFF";
            ctx.font = "bold 19px Arial";

            y = drawWrappedText(

                ctx,

                app.address || "Unknown Address",

                layout.valueX,

                y,

                canvas.width - layout.valueX - 25,

                layout.addressLineHeight

            );

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
    " ✔ VERIFIED USING RJAB CAMERA SYSTEM",
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

            console.log("Watermark V2 Created");

            resolve();

        };

        img.onerror = function () {

            reject("Unable to load image.");

        };

        img.src = app.photoData;

    });

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

        status.innerHTML = "✅ Watermark Ready";

        useBtn.disabled = false;
        useBtn.hidden = true;

    }

    catch (error) {

    console.error(error);

    alert("GPS ERROR\n\n" + error);

    status.innerHTML = "❌ GPS Failed";

    useBtn.disabled = false;

}
   
};

// ============================
// START
// ============================

startCamera();
