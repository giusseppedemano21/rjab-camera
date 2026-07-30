const video = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const preview = document.getElementById("preview");

const captureBtn = document.getElementById("captureBtn");
const retakeBtn = document.getElementById("retakeBtn");
const useBtn = document.getElementById("useBtn");

const guide = document.getElementById("guide");
const status = document.getElementById("status");

let stream = null;

// =============================
// PHOTO DATA
// =============================

let photoData = "";

// =============================
// GPS INFORMATION
// =============================

let latitude = "";
let longitude = "";
let accuracy = "";
let address = "";

// ============================
// START CAMERA
// ============================

async function startCamera() {

    try {

        stream = await navigator.mediaDevices.getUserMedia({

            video: {
                facingMode: "user"
            },

            audio: false

        });

        video.srcObject = stream;

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

    photoData = canvas.toDataURL("image/jpeg", 0.9);

    preview.src = photoData;

    preview.hidden = false;

    video.hidden = true;

    guide.hidden = true;

    captureBtn.hidden = true;

    retakeBtn.hidden = false;

    useBtn.hidden = false;

    status.innerHTML = "📸 Preview";

};

// ============================
// RETAKE
// ============================

retakeBtn.onclick = function () {

    preview.hidden = true;

    video.hidden = false;

    guide.hidden = false;

    captureBtn.hidden = false;

    retakeBtn.hidden = true;

    useBtn.hidden = true;

    status.innerHTML = "✅ Camera Ready";

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

                latitude  = position.coords.latitude.toFixed(6);
                longitude = position.coords.longitude.toFixed(6);
                accuracy  = Math.round(position.coords.accuracy);

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

    if (!latitude || !longitude) {

        address = "GPS not available";
        return;

    }

    try {

        const url =
            "https://nominatim.openstreetmap.org/reverse?format=jsonv2" +
            "&lat=" + latitude +
            "&lon=" + longitude;

        const response = await fetch(url, {

            headers: {
                "Accept": "application/json"
            }

        });

        const data = await response.json();

        address = data.display_name || "Unknown Address";

    }

    catch (error) {

        console.error(error);

        address = "Address not available";

    }

}

// ============================
// USE PHOTO
// ============================

useBtn.onclick = async function () {

    status.innerHTML = "📍 Getting GPS...";

    try {

        await getGPS();

        status.innerHTML = "🌍 Getting Address...";

        await getAddress();

        console.log({

            latitude,
            longitude,
            accuracy,
            address

        });

        alert(

            "GPS SUCCESS\n\n" +

            "Latitude : " + latitude +

            "\nLongitude : " + longitude +

            "\nAccuracy : ±" + accuracy + " m" +

            "\n\nAddress\n\n" +

            address

        );

        status.innerHTML = "✅ GPS Ready";

    }

    catch (error) {

        alert("GPS ERROR\n\n" + error);

        status.innerHTML = "❌ GPS Failed";

    }

};

// ============================
// START
// ============================

startCamera();
