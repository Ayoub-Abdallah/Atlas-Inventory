interface ScannerOptions {
  onCode?: (code: string) => void;
  formats?: string[];
}

interface ScannerState {
  isSupported: boolean;
  isScanning: boolean;
  hasPermission: boolean | null;
  error: string | null;
}

export function useScanner(options: ScannerOptions = {}) {
  const state = reactive<ScannerState>({
    isSupported: false,
    isScanning: false,
    hasPermission: null,
    error: null,
  });

  const videoRef = ref<HTMLVideoElement | null>(null);
  const canvasRef = ref<HTMLCanvasElement | null>(null);
  let detector: BarcodeDetector | null = null;
  let animationFrameId: number | null = null;
  let stream: MediaStream | null = null;

  // Check if BarcodeDetector is supported
  const checkSupport = () => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      state.isSupported = true;
      return true;
    }
    state.isSupported = false;
    return false;
  };

  // Initialize the barcode detector
  const initDetector = async () => {
    if (!checkSupport()) {
      state.error = 'BarcodeDetector API not supported';
      return false;
    }

    try {
      const formats = options.formats || ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e'];
      // @ts-ignore - BarcodeDetector types may not be available
      detector = new BarcodeDetector({ formats });
      return true;
    } catch (e) {
      state.error = 'Failed to initialize barcode detector';
      return false;
    }
  };

  // Start camera and scanning
  const start = async (video: HTMLVideoElement, canvas?: HTMLCanvasElement) => {
    videoRef.value = video;
    if (canvas) canvasRef.value = canvas;

    if (!await initDetector()) {
      return false;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      state.hasPermission = true;
      video.srcObject = stream;
      await video.play();

      state.isScanning = true;
      scanFrame();
      return true;
    } catch (e: any) {
      state.hasPermission = false;
      state.error = e.name === 'NotAllowedError' 
        ? 'Camera permission denied'
        : 'Failed to access camera';
      return false;
    }
  };

  // Scan a single frame
  const scanFrame = async () => {
    if (!state.isScanning || !videoRef.value || !detector) return;

    try {
      // @ts-ignore
      const barcodes = await detector.detect(videoRef.value);
      
      if (barcodes.length > 0 && barcodes[0]) {
        const code = barcodes[0].rawValue;
        if (code && options.onCode) {
          options.onCode(code);
        }
      }
    } catch (e) {
      // Silently ignore detection errors
    }

    if (state.isScanning) {
      animationFrameId = requestAnimationFrame(scanFrame);
    }
  };

  // Stop scanning
  const stop = () => {
    state.isScanning = false;

    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }

    if (videoRef.value) {
      videoRef.value.srcObject = null;
    }
  };

  // Handle HID scanner input (keyboard wedge mode)
  // HID scanners typically send digits rapidly followed by Enter
  const hidBuffer = ref('');
  const hidTimeout = ref<ReturnType<typeof setTimeout> | null>(null);

  const handleHidInput = (event: KeyboardEvent) => {
    // Clear timeout on each keystroke
    if (hidTimeout.value) {
      clearTimeout(hidTimeout.value);
    }

    if (event.key === 'Enter') {
      // If we have a buffer with 6+ digits, treat it as a barcode
      if (hidBuffer.value.length >= 6 && /^\d+$/.test(hidBuffer.value)) {
        if (options.onCode) {
          options.onCode(hidBuffer.value);
        }
        event.preventDefault();
      }
      hidBuffer.value = '';
      return;
    }

    // Only accumulate digits
    if (/^\d$/.test(event.key)) {
      hidBuffer.value += event.key;
    }

    // Clear buffer after 100ms of no input (human typing is slower)
    hidTimeout.value = setTimeout(() => {
      hidBuffer.value = '';
    }, 100);
  };

  // Cleanup on unmount
  onUnmounted(() => {
    stop();
    if (hidTimeout.value) {
      clearTimeout(hidTimeout.value);
    }
  });

  return {
    ...toRefs(state),
    start,
    stop,
    handleHidInput,
    checkSupport,
  };
}

// Type declaration for BarcodeDetector
declare global {
  interface Window {
    BarcodeDetector: typeof BarcodeDetector;
  }
  
  class BarcodeDetector {
    constructor(options?: { formats: string[] });
    detect(source: HTMLVideoElement | HTMLImageElement | ImageBitmap): Promise<{ rawValue: string }[]>;
    static getSupportedFormats(): Promise<string[]>;
  }
}
