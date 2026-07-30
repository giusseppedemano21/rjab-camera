const video = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const preview = document.getElementById("preview");

const captureBtn = document.getElementById("captureBtn");
const retakeBtn = document.getElementById("retakeBtn");
const useBtn = document.getElementById("useBtn");

const status = document.getElementById("status");

let stream = null;

// Start Camera
async function startCamera() {

    try {

        stream = await navigator.mediaDevices.getUserMedia({

            video: {
                facingMode: "user"
            },

            audio: false

        });

        video.srcObject = stream;

        status.innerText = "✅ Camera Ready";

    } catch (err) {

        console.error(err);

        status.innerText = "❌ Unable to access camera.";

    }

}

// Capture
captureBtn.addEventListener("click", () => {

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    ctx.drawImage(video, 0, 0);

    preview.src = canvas.toDataURL("image/jpeg");

    preview.hidden = false;
    video.hidden = true;

    captureBtn.hidden = true;
    retakeBtn.hidden = false;
    useBtn.hidden = false;

    status.innerText = "📷 Photo Captured";

});

// Retake
retakeBtn.addEventListener("click", () => {

    preview.hidden = true;
    video.hidden = false;

    captureBtn.hidden = false;
    retakeBtn.hidden = true;
    useBtn.hidden = true;

    status.innerText = "📷 Camera Ready";

});

// Temporary
useBtn.addEventListener("click", () => {

    alert("Next Step: Upload to Apps Script");

});

startCamera();
