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

    const words = text.split(" ");

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

            
            const footerHeight = 500;

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

            // Draw original photo
            ctx.drawImage(img, 0, 0);

            // ============================
// BLACK FOOTER
// ============================

ctx.fillStyle = "#000000";
ctx.fillRect(
    0,
    img.height,
    canvas.width,
    footerHeight
);

// ============================
// FOOTER TEXT
// ============================

ctx.fillStyle = "#FFFFFF";

ctx.textAlign = "center";

ctx.font = "bold 34px Arial";

ctx.fillText(
    "RJAB CORPORATION",
    canvas.width / 2,
    img.height + 45
);

ctx.font = "24px Arial";

ctx.fillText(
    "PHOTO VERIFICATION",
    canvas.width / 2,
    img.height + 80
);

ctx.textAlign = "left";

ctx.font = "20px Arial";

let y = img.height + 120;

ctx.fillText("Date      : " + dateText, 20, y);

y += 30;

ctx.fillText("Time      : " + timeText, 20, y);

y += 30;

ctx.fillText("Type      : " + app.type, 20, y);

y += 30;

ctx.fillText("Agent     : " + app.agent, 20, y);

y += 30;

ctx.fillText("Zone      : " + app.zone, 20, y);

y += 30;

ctx.fillText("Accuracy  : ±" + app.accuracy + " m", 20, y);

y += 30;

ctx.fillText("Location :", 20, y);

y += 30;

y = drawWrappedText(

    ctx,

    app.address,

    20,

    y,

    canvas.width - 40,

    26

);

            // Save new image
            app.photoData = canvas.toDataURL("image/jpeg", 0.95);

            // Update preview
            preview.src = app.photoData;

            console.log("Watermark canvas created.");

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

    }

    catch (error) {

        console.error(error);

        alert("GPS ERROR\n\n" + error);

        status.innerHTML = "❌ GPS Failed";

    }

    finally {

        useBtn.disabled = false;

    }

};

// ============================
// START
// ============================

startCamera();
