/**
 * Dreamlab Canvas — Offscreen Document
 * Handles tab video recording with area cropping.
 * Created on-demand by background.js for area video capture.
 */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    // Only handle messages targeted at this offscreen document
    if (msg.target !== 'offscreen') return false;

    if (msg.action === 'startRecording') {
        startRecording(msg)
            .then(sendResponse)
            .catch((e) => sendResponse({ success: false, error: e.message }));
        return true; // async response
    }

    return false;
});

async function startRecording({ streamId, rect, dpr, maxDurationMs = 10000 }) {
    // 1. Get the tab's MediaStream from the stream ID
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
            mandatory: {
                chromeMediaSource: 'tab',
                chromeMediaSourceId: streamId,
            },
        },
    });

    // 2. Calculate crop region in device pixels
    const cropX = Math.round(rect.x * dpr);
    const cropY = Math.round(rect.y * dpr);
    const cropW = Math.round(rect.width * dpr);
    const cropH = Math.round(rect.height * dpr);

    // Cap canvas resolution to avoid excessive memory usage
    const maxDim = 1920;
    let canvasW = cropW;
    let canvasH = cropH;
    if (canvasW > maxDim || canvasH > maxDim) {
        const scale = Math.min(maxDim / canvasW, maxDim / canvasH);
        canvasW = Math.round(canvasW * scale);
        canvasH = Math.round(canvasH * scale);
    }

    // 3. Create canvas for cropping
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');

    // 4. Create video element to receive stream
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();

    // 5. Draw cropped frames to canvas
    let recording = true;
    const startTime = Date.now();

    function drawFrame() {
        if (!recording) return;
        ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvasW, canvasH);
        requestAnimationFrame(drawFrame);
    }
    drawFrame();

    // 6. Record canvas stream
    const canvasStream = canvas.captureStream(30);

    // Try VP9 first, fall back to VP8
    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
    }

    const recorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: 2_500_000,
    });

    const chunks = [];
    recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
    };

    return new Promise((resolve) => {
        recorder.onstop = () => {
            recording = false;
            const durationMs = Date.now() - startTime;

            // Stop all tracks
            stream.getTracks().forEach((t) => t.stop());
            canvasStream.getTracks().forEach((t) => t.stop());
            video.srcObject = null;

            const blob = new Blob(chunks, { type: 'video/webm' });

            // Convert to base64 data URL for transport back to background
            const reader = new FileReader();
            reader.onloadend = () => {
                resolve({
                    success: true,
                    dataUrl: reader.result,
                    mimeType: 'video/webm',
                    durationMs,
                    sizeBytes: blob.size,
                });
            };
            reader.onerror = () => {
                resolve({ success: false, error: 'Failed to read recorded video.' });
            };
            reader.readAsDataURL(blob);
        };

        recorder.start();

        // Auto-stop after maxDuration
        setTimeout(() => {
            if (recorder.state === 'recording') {
                recorder.stop();
            }
        }, maxDurationMs);
    });
}
