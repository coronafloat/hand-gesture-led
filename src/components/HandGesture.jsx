import { useEffect, useRef, useState } from "react";
import { Hands, HAND_CONNECTIONS } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

function HandGesture() {
    const [gestureText, setGestureText] = useState("OFF");
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const handsRef = useRef(null);
    const cameraRef = useRef(null);

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

            // Initialize camera
            if (videoRef.current) {
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

        initializeHandTracking();

        // Cleanup
        return () => {
            if (cameraRef.current) {
                cameraRef.current.stop();
            }
            if (handsRef.current) {
                handsRef.current.close();
            }
        };
    }, []);

    const onResults = (results) => {
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
            setGestureText(isOpen ? "ON" : "OFF");
        }

        canvasCtx.restore();
    };

    const areAllFingersOpen = (landmarks) => {
        // MediaPipe hand landmarks:
        // - Wrist: 0
        // - Thumb: 1 (CMC) -> 2 (MCP) -> 3 (IP) -> 4 (TIP)
        // - Index: 5 (MCP) -> 6 (PIP) -> 7 (DIP) -> 8 (TIP)
        // - Middle: 9 (MCP) -> 10 (PIP) -> 11 (DIP) -> 12 (TIP)
        // - Ring: 13 (MCP) -> 14 (PIP) -> 15 (DIP) -> 16 (TIP)
        // - Pinky: 17 (MCP) -> 18 (PIP) -> 19 (DIP) -> 20 (TIP)

        // Calculate distance between points using 3D euclidean distance
        const dist = (p1, p2) => {
            return Math.sqrt(
                Math.pow(p1.x - p2.x, 2) +
                    Math.pow(p1.y - p2.y, 2) +
                    Math.pow(p1.z - p2.z, 2)
            );
        };

        // compared to knuckles and wrist
        // When fingers are extended, this ratio will be higher
        // Hitung jarak ujung jari ke pergelangan tangan dibagi jarak pangkal jari ke pergelangan tangan

        // For thumb
        const thumbRatio =
            dist(landmarks[4], landmarks[0]) / dist(landmarks[2], landmarks[0]);

        // For other fingers
        const indexRatio =
            dist(landmarks[8], landmarks[0]) / dist(landmarks[5], landmarks[0]);
        const middleRatio =
            dist(landmarks[12], landmarks[0]) /
            dist(landmarks[9], landmarks[0]);
        const ringRatio =
            dist(landmarks[16], landmarks[0]) /
            dist(landmarks[13], landmarks[0]);
        const pinkyRatio =
            dist(landmarks[20], landmarks[0]) /
            dist(landmarks[17], landmarks[0]);

        // Threshold values to determine if fingers are open (boolean return)
        const threshold = 1.7;

        const thumbIsOpen = thumbRatio > threshold;
        const indexIsOpen = indexRatio > threshold;
        const middleIsOpen = middleRatio > threshold;
        const ringIsOpen = ringRatio > threshold;
        const pinkyIsOpen = pinkyRatio > threshold;

        return (
            thumbIsOpen &&
            indexIsOpen &&
            middleIsOpen &&
            ringIsOpen &&
            pinkyIsOpen
        );
    };

    return (
        <div className="flex justify-center h-screen items-center bg-red-200">
            <div className="flex flex-col justify-center items-center gap-4 bg-amber-100">
                <div className="flex bg-blue-600 text-4xl font-bold">
                    Hand Gesture Detector
                </div>
                <div className="flex bg-green-500">
                    <video ref={videoRef} style={{ display: "none" }} />
                    <canvas
                        ref={canvasRef}
                        width="640"
                        height="480"
                        className="border border-black rounded"
                    />
                </div>
                <div className="flex bg-red-500">Status: {gestureText}</div>
            </div>
        </div>
    );
}

export default HandGesture;
