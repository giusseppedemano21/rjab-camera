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
// GPS INFORMATION
// =============================

let latitude = "";
let longitude = "";
let accuracy = "";
let address = "";

// ============================
// START CAMERA
// ============================

async function startCamera(){

    try{

        stream = await navigator.mediaDevices.getUserMedia({

            video:{
                facingMode:"user"
            },

            audio:false

        });

        video.srcObject = stream;

        await video.play();

        status.innerHTML="📷 Camera Ready...";

    }

    catch(error){

        console.error(error);

        status.innerHTML="❌ Camera Access Denied";

    }

}
// =============================
// GET GPS LOCATION
// =============================

function getLocation() {

    if (!navigator.geolocation) {

        status.innerHTML = "❌ GPS is not supported.";
        return;

    }

    status.innerHTML = "📍 Getting GPS location...";

    navigator.geolocation.getCurrentPosition(

        function(position){

            latitude  = position.coords.latitude.toFixed(6);
            longitude = position.coords.longitude.toFixed(6);
            accuracy  = Math.round(position.coords.accuracy);

            console.log("Latitude :", latitude);
            console.log("Longitude:", longitude);
            console.log("Accuracy :", accuracy + " m");

            status.innerHTML = "✅ Camera & GPS Ready";

},

            status.innerHTML = "✅ Camera & GPS Ready";

        },

        function(error){

            console.log(error);
            status.innerHTML = "❌ Unable to get GPS.";

        },

        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        }

    );

}
// ============================
// CAPTURE
// ============================

captureBtn.onclick=function(){

    canvas.width=video.videoWidth;

    canvas.height=video.videoHeight;

    const ctx=canvas.getContext("2d");

    ctx.drawImage(video,0,0);

    preview.src=canvas.toDataURL("image/jpeg",0.9);

    preview.hidden=false;

    video.hidden=true;

    guide.hidden=true;

    captureBtn.hidden=true;

    retakeBtn.hidden=false;

    useBtn.hidden=false;

    status.innerHTML="📸 Preview";

};

// ============================
// RETAKE
// ============================

retakeBtn.onclick=function(){

    preview.hidden=true;

    video.hidden=false;

    guide.hidden=false;

    captureBtn.hidden=false;

    retakeBtn.hidden=true;

    useBtn.hidden=true;

    if (latitude !== "") {

    status.innerHTML = "✅ Camera & GPS Ready";

} else {

    status.innerHTML = "📍 Waiting for GPS...";

}

};

// ============================
// USE PHOTO
// ============================

useBtn.onclick=function(){

    alert("Next Sprint : Upload to Apps Script");

};

// ============================

startCamera().then(() => {
    getLocation();
});
