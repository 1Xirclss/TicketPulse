import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, Flashlight, RefreshCw, Smartphone } from 'lucide-react';

export default function QrCameraScanner({ onScan, disabled = false }) {
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  const scannerRef = useRef(null);
  const readerElementId = 'nexo-gate-qr-reader';
  const lastScannedCodeRef = useRef('');
  const lastScannedTimeRef = useRef(0);

  // Cargar lista de cámaras disponibles
  async function loadCameras() {
    try {
      setCameraError('');
      const devices = await Html5Qrcode.getCameras();
      if (!devices || !devices.length) {
        setCameraError('No se encontraron cámaras en este dispositivo.');
        return;
      }
      setCameras(devices);

      // Preferir cámara trasera ('back', 'environment', 'trasera') si existe
      const backCam = devices.find(d => /back|rear|environment|trasera|posterior/i.test(d.label));
      const defaultCam = backCam || devices[0];
      setSelectedCameraId(defaultCam.id);
    } catch (err) {
      setCameraError('Permiso de cámara denegado o no disponible en este navegador: ' + (err.message || ''));
    }
  }

  useEffect(() => {
    loadCameras();
    return () => {
      stopScanning();
    };
  }, []);

  async function startScanning(cameraId) {
    if (disabled) return;
    const targetCamera = cameraId || selectedCameraId;
    if (!targetCamera) return;

    try {
      setCameraError('');
      if (scannerRef.current) {
        await stopScanning();
      }

      const html5QrCode = new Html5Qrcode(readerElementId, {
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      });
      scannerRef.current = html5QrCode;

      const qrConfig = {
        fps: 15,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const edgeSize = Math.floor(minEdge * 0.72);
          return { width: edgeSize, height: edgeSize };
        },
        aspectRatio: 1.0
      };

      await html5QrCode.start(
        targetCamera,
        qrConfig,
        (decodedText) => {
          const now = Date.now();
          const cleanText = decodedText.trim();
          // Prevenir múltiples lecturas idénticas en ráfaga (cooldown de 2 segundos)
          if (cleanText === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 2000) {
            return;
          }
          lastScannedCodeRef.current = cleanText;
          lastScannedTimeRef.current = now;
          if (onScan) {
            onScan(cleanText);
          }
        },
        () => {
          // Fallo de frame silencioso habitual mientras busca QR
        }
      );

      setIsScanning(true);

      // Verificar si la cámara soporta antorcha / linterna (torch)
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities();
        if (capabilities && 'torch' in capabilities) {
          setTorchAvailable(true);
        } else {
          setTorchAvailable(false);
        }
      } catch {
        setTorchAvailable(false);
      }
    } catch (err) {
      setIsScanning(false);
      setCameraError('No se pudo inicializar la cámara seleccionada: ' + (err.message || ''));
    }
  }

  async function stopScanning() {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch {
        // Ignorar errores al desmontar
      } finally {
        scannerRef.current = null;
        setIsScanning(false);
        setTorchOn(false);
      }
    }
  }

  async function toggleTorch() {
    if (!scannerRef.current || !torchAvailable) return;
    try {
      const nextState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState }]
      });
      setTorchOn(nextState);
    } catch (err) {
      console.warn('Error alternando linterna:', err);
    }
  }

  async function handleCameraChange(cameraId) {
    setSelectedCameraId(cameraId);
    if (isScanning) {
      await startScanning(cameraId);
    }
  }

  return (
    <div className="gate-scanner-box">
      <div className="scanner-viewport-container">
        <div id={readerElementId} className="scanner-viewport" />

        {isScanning && (
          <div className="scanner-reticle-overlay" aria-hidden="true">
            <div className="scanner-target-frame">
              <span className="corner top-left" />
              <span className="corner top-right" />
              <span className="corner bottom-left" />
              <span className="corner bottom-right" />
              <div className="scanner-laser-line" />
            </div>
          </div>
        )}

        {!isScanning && (
          <div className="scanner-idle-placeholder">
            <Camera size={48} className="idle-camera-icon" />
            <p className="idle-title">Cámara en espera</p>
            <p className="idle-subtitle">Presiona "Iniciar escáner" para leer boletos QR.</p>
            <button
              className="primary-button"
              disabled={disabled || !selectedCameraId}
              onClick={() => startScanning(selectedCameraId)}
            >
              <Camera size={18} /> Iniciar escáner
            </button>
          </div>
        )}
      </div>

      {cameraError && (
        <div className="alert error" role="alert">
          {cameraError}
          <button className="text-button" onClick={loadCameras}>
            Reintentar acceso
          </button>
        </div>
      )}

      <div className="scanner-controls-bar">
        <div className="camera-select-wrap">
          <Smartphone size={16} />
          <label htmlFor="gate-camera-select" className="sr-only">
            Seleccionar cámara
          </label>
          <select
            id="gate-camera-select"
            value={selectedCameraId}
            onChange={(e) => handleCameraChange(e.target.value)}
            disabled={!cameras.length || disabled}
          >
            {!cameras.length && <option value="">Sin cámaras detectadas</option>}
            {cameras.map((c, i) => (
              <option key={c.id} value={c.id}>
                {c.label || `Cámara ${i + 1}`}
              </option>
            ))}
          </select>
        </div>

        <div className="scanner-action-buttons">
          {torchAvailable && isScanning && (
            <button
              className={`icon-button torch-button ${torchOn ? 'active' : ''}`}
              onClick={toggleTorch}
              title={torchOn ? 'Apagar flash' : 'Encender flash'}
              aria-label={torchOn ? 'Apagar flash' : 'Encender flash'}
            >
              <Flashlight size={18} />
            </button>
          )}

          {isScanning ? (
            <button
              className="secondary-button compact stop-button"
              onClick={stopScanning}
              title="Detener cámara"
            >
              <CameraOff size={16} /> Detener
            </button>
          ) : (
            <button
              className="secondary-button compact"
              onClick={() => startScanning(selectedCameraId)}
              disabled={disabled || !selectedCameraId}
            >
              <Camera size={16} /> Activar
            </button>
          )}

          <button
            className="icon-button"
            onClick={loadCameras}
            title="Recargar cámaras disponibles"
            aria-label="Recargar cámaras"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
