interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats: string[] }) => BarcodeDetectorLike;
  }
}

export interface ScannerHandle {
  stop: () => void;
}

/**
 * Escanea EAN/UPC desde la cámara trasera. Usa la API nativa BarcodeDetector (Chrome Android,
 * rapidísima) y, si no existe (Safari, Firefox), carga ZXing bajo demanda para no inflar el bundle.
 */
export async function startBarcodeScanner(video: HTMLVideoElement, onCode: (code: string) => void): Promise<ScannerHandle> {
  if (window.BarcodeDetector) {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    video.srcObject = stream;
    await video.play();
    const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
    let active = true;
    const tick = async () => {
      if (!active) return;
      try {
        const codes = await detector.detect(video);
        if (codes[0]?.rawValue) {
          active = false;
          onCode(codes[0].rawValue);
          return;
        }
      } catch {
        /* frame no listo todavía */
      }
      window.setTimeout(tick, 180);
    };
    void tick();
    return {
      stop: () => {
        active = false;
        stream.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      },
    };
  }

  const { BrowserMultiFormatReader } = await import('@zxing/browser');
  const reader = new BrowserMultiFormatReader();
  let done = false;
  const controls = await reader.decodeFromConstraints(
    { video: { facingMode: 'environment' }, audio: false },
    video,
    (result) => {
      if (result && !done) {
        done = true;
        onCode(result.getText());
      }
    },
  );
  return { stop: () => controls.stop() };
}
