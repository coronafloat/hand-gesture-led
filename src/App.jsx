import { useEffect, useRef, useState, useCallback } from "react";
import { Hands, HAND_CONNECTIONS } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import './App.css'

function App() {
    const [gestureText, setGestureText] = useState("OFF");
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const handsRef = useRef(null);
    const cameraRef = useRef(null);

    const onResults = useCallback((results) => {
        if (!canvasRef.current) return;

        const canvasCtx = canvasRef.current.getContext("2d");
        const { width, height } = canvasRef.current;

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, width, height);

        // Draw video frame
        canvasCtx.drawImage(results.image, 0, 0, width, height);

        if (
            results.multiHandLandmarks &&
            results.multiHandLandmarks.length > 0
        ) {
            const landmarks = results.multiHandLandmarks[0];

            // Draw hand landmarks and connections
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
                color: "#00FF00",
                lineWidth: 5,
            });
            drawLandmarks(canvasCtx, landmarks, {
                color: "#FF0000",
                lineWidth: 2,
            });

            // Check if all fingers are open or closed
            const isOpen = areAllFingersOpen(landmarks);
            const newGestureText = isOpen ? "ON" : "OFF";
            setGestureText(newGestureText);

            // Send the gesture data to the ESP32 server
            sendGestureToESP32(newGestureText);
        }

        canvasCtx.restore();
    }, []);

    const sendGestureToESP32 = (gestureState) => {
        fetch("http://192.168.4.1/led", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: `state=${gestureState}`,
        })
            .then((response) => response.text())
            .then((data) => {
                console.log("LED state:", data);
            })
            .catch((error) => {
                console.error("Error sending data to ESP32:", error);
            });
    };

    // Initialize MediaPipe Hands
    useEffect(() => {
        const initializeHandTracking = async () => {
            // Initialize MediaPipe Hands
            handsRef.current = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                },
            });

            handsRef.current.setOptions({
                maxNumHands: 1,
                modelComplexity: 1,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
            });

            handsRef.current.onResults(onResults);

            // Automatically start camera when component mounts
            if (videoRef.current) {
                startCamera();
            }
        };
        initializeHandTracking();

        // Cleanup
        return () => {
            stopCamera();
        };
    }, [onResults]);

    // Function to start the camera
    const startCamera = () => {
        if (videoRef.current && !cameraRef.current) {
            cameraRef.current = new Camera(videoRef.current, {
                onFrame: async () => {
                    if (handsRef.current) {
                        await handsRef.current.send({
                            image: videoRef.current,
                        });
                    }
                },
                width: 640,
                height: 480,
            });
            cameraRef.current.start();
        }
    };

    // Function to stop the camera
    const stopCamera = () => {
        if (cameraRef.current) {
            cameraRef.current.stop();
            cameraRef.current = null;

            // Clear canvas when camera is stopped
            if (canvasRef.current) {
                const canvasCtx = canvasRef.current.getContext("2d");
                canvasCtx.clearRect(
                    0,
                    0,
                    canvasRef.current.width,
                    canvasRef.current.height
                );
            }

            // Reset gesture text
            setGestureText("OFF");
        }
    };

    const areAllFingersOpen = (landmarks) => {
        const dist = (p1, p2) => {
            return Math.sqrt(
                Math.pow(p1.x - p2.x, 2) +
                    Math.pow(p1.y - p2.y, 2) +
                    Math.pow(p1.z - p2.z, 2)
            );
        };

        const thumbRatio =
            dist(landmarks[4], landmarks[0]) / dist(landmarks[2], landmarks[0]);
        const indexRatio =
            dist(landmarks[8], landmarks[0]) / dist(landmarks[5], landmarks[0]);
        const middleRatio =
            dist(landmarks[12], landmarks[0]) / dist(landmarks[9], landmarks[0]);
        const ringRatio =
            dist(landmarks[16], landmarks[0]) / dist(landmarks[13], landmarks[0]);
        const pinkyRatio =
            dist(landmarks[20], landmarks[0]) / dist(landmarks[17], landmarks[0]);

        const threshold = 1.7;

        return (
            thumbRatio > threshold &&
            indexRatio > threshold &&
            middleRatio > threshold &&
            ringRatio > threshold &&
            pinkyRatio > threshold
        );
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-500 px-4 py-8">
            <div className="w-full max-w-4xl flex flex-col items-center gap-6 bg-white shadow-2xl rounded-2xl p-6 sm:p-10">
                {/* Judul */}
                <div className="text-center text-3xl sm:text-4xl md:text-5xl font-extrabold text-white bg-black px-6 py-4 rounded-xl shadow-md">
                    Hand Gesture Detector
                </div>

                {/* Video & Canvas */}
                <div className="relative w-full flex justify-center items-center rounded-lg overflow-hidden bg-gray-800 shadow-lg aspect-video">
                    <video ref={videoRef} className="hidden" />
                    <canvas
                        ref={canvasRef}
                        width="640"
                        height="480"
                        className="w-full max-w-full h-auto border border-gray-300 rounded bg-gray-500"
                    />
                </div>

                {/* Status */}
                <div className="text-lg sm:text-xl md:text-2xl text-center text-white font-semibold px-4 py-3 bg-red-500 rounded-xl shadow-md">
                    Status: {gestureText}
                </div>
            </div>
        </div>
    );
}

export default App;
