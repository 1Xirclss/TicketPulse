import { useCallback, useEffect, useRef, useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  DoorOpen, 
  Maximize2, 
  Minimize2, 
  QrCode, 
  Radio, 
  RefreshCw, 
  Search, 
  ShieldCheck, 
  Ticket, 
  Users, 
  Volume2, 
  VolumeX, 
  X, 
  XCircle 
} from 'lucide-react';
import { useEvent } from '../context/EventContext';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';
import { playErrorBuzzer, playSuccessChime } from '../utils/audio';
import { number, timeLabel } from '../utils/format';
import QrCameraScanner from '../components/gate/QrCameraScanner';
import ManualSearch from '../components/gate/ManualSearch';

export default function Gate() {
  const { user } = useAuth();
  const { evento, selectedId } = useEvent();

  const [activeTab, setActiveTab] = useState('camera'); // 'camera' | 'manual'
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  const [validationResult, setValidationResult] = useState(null);
  const [validating, setValidating] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const gateContainerRef = useRef(null);

  // Cargar resumen de aforo e ingresos en puerta
  const fetchSummary = useCallback(async (signal) => {
    if (!evento?._id) return;
    try {
      setSummaryLoading(true);
      const data = await api(`/puerta/resumen?evento=${evento._id}`, { signal });
      setSummary(data);
      setSummaryError('');
    } catch (err) {
      if (err.name !== 'AbortError') {
        setSummaryError(err.message || 'Error cargando métricas de puerta');
      }
    } finally {
      setSummaryLoading(false);
    }
  }, [evento?._id]);

  useEffect(() => {
    const controller = new AbortController();
    fetchSummary(controller.signal);

    // Sondeo periódico cada 8 segundos para mantener las cifras al día
    const interval = setInterval(() => {
      fetchSummary();
    }, 8000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchSummary]);

  // Validar boleto (escaneado por cámara o introducido manualmente)
  async function handleValidate(ticketCode) {
    if (!ticketCode || validating || !evento?._id) return;

    setValidating(true);
    try {
      const response = await api('/puerta/validar', {
        method: 'POST',
        body: { ticketCode, eventoId: evento._id }
      });

      setValidationResult({
        status: 'PERMITIDO',
        mensaje: response.mensaje || 'Acceso permitido',
        asistente: response.asistente,
        timestamp: new Date()
      });

      if (soundEnabled) {
        playSuccessChime();
      }

      // Actualizar métricas de aforo al instante
      fetchSummary();
    } catch (err) {
      setValidationResult({
        status: 'DENEGADO',
        mensaje: err.message || 'Acceso denegado',
        horaFormateada: err.horaFormateada,
        asistente: err.asistente,
        primerIngreso: err.primerIngreso,
        timestamp: new Date()
      });

      if (soundEnabled) {
        playErrorBuzzer();
      }

      fetchSummary();
    } finally {
      setValidating(false);
    }
  }

  // Alternar pantalla completa
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      gateContainerRef.current?.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  if (!evento) {
    return (
      <section className="empty-panel">
        <DoorOpen size={36} />
        <h1>Selecciona un evento para abrir el control en puerta.</h1>
        <p>Utiliza el selector superior de eventos para comenzar a validar ingresos.</p>
      </section>
    );
  }

  const porcentaje = summary?.porcentajeIngreso ?? 0;
  const aforoTotal = summary?.totalAforo || evento.aforoMaximo || 0;
  const ingresados = summary?.ingresadosEnPuerta || 0;
  const pendientes = summary?.pendientesPorIngresar || 0;
  const pulseras = summary?.pulserasEntregadas || 0;

  return (
    <div ref={gateContainerRef} className={`gate-page ${isFullscreen ? 'gate-fullscreen-mode' : ''}`}>
      {/* Cabecera del módulo de puerta */}
      <header className="gate-header-bar">
        <div className="gate-header-left">
          <div className="gate-title-group">
            <span className="gate-badge-live">
              <Radio size={12} className="live-dot" /> EN VIVO
            </span>
            <h1>Control en Puerta</h1>
          </div>
          <p className="gate-event-name">
            {evento.nombre} · {evento.venue || 'Recinto principal'}
          </p>
        </div>

        <div className="gate-header-controls">
          <button
            className={`gate-control-btn ${soundEnabled ? 'active' : ''}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Silenciar sonidos' : 'Activar sonidos'}
            aria-label={soundEnabled ? 'Silenciar sonidos' : 'Activar sonidos'}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            <span>{soundEnabled ? 'Sonido ON' : 'Silencio'}</span>
          </button>

          <button
            className="gate-control-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa / Modo tableta'}
            aria-label="Pantalla completa"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            <span>{isFullscreen ? 'Salir' : 'Kiosco'}</span>
          </button>
        </div>
      </header>

      {/* Aforómetro gigante en tiempo real */}
      <section className="gate-attendance-meter" aria-label="Métricas de aforo e ingresos">
        <div className="meter-header">
          <div className="meter-label-wrap">
            <Users size={20} />
            <span className="meter-caption">AFORO TOTAL OCUPADO</span>
          </div>
          <div className="meter-percentage-badge">
            <strong>{porcentaje}%</strong>
            <small>ingresado</small>
          </div>
        </div>

        <div className="meter-progress-track">
          <div
            className="meter-progress-bar"
            style={{ width: `${Math.min(100, Math.max(0, porcentaje))}%` }}
          />
        </div>

        <div className="meter-stats-grid">
          <div className="meter-stat-card">
            <span className="stat-label">Ingresados</span>
            <strong className="stat-value highlight-enter">{number(ingresados)}</strong>
            <small className="stat-sub">en recinto</small>
          </div>

          <div className="meter-stat-card">
            <span className="stat-label">Pendientes</span>
            <strong className="stat-value">{number(pendientes)}</strong>
            <small className="stat-sub">por llegar</small>
          </div>

          <div className="meter-stat-card">
            <span className="stat-label">Pulseras</span>
            <strong className="stat-value highlight-wristband">{number(pulseras)}</strong>
            <small className="stat-sub">entregadas</small>
          </div>

          <div className="meter-stat-card">
            <span className="stat-label">Aforo máx.</span>
            <strong className="stat-value">{number(aforoTotal)}</strong>
            <small className="stat-sub">capacidad</small>
          </div>
        </div>
      </section>

      {/* Tarjeta de resultado visual en grande */}
      {validationResult && (
        <section
          className={`gate-result-banner ${
            validationResult.status === 'PERMITIDO' ? 'result-success' : 'result-error'
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="result-banner-icon">
            {validationResult.status === 'PERMITIDO' ? (
              <CheckCircle2 size={44} />
            ) : (
              <XCircle size={44} />
            )}
          </div>

          <div className="result-banner-content">
            <div className="result-banner-title-row">
              <h2>
                {validationResult.status === 'PERMITIDO'
                  ? 'ACCESO PERMITIDO'
                  : 'ACCESO DENEGADO'}
              </h2>
              <span className="result-banner-time">
                {timeLabel(validationResult.timestamp, evento.zonaHoraria)}
              </span>
            </div>

            <p className="result-banner-message">{validationResult.mensaje}</p>

            {validationResult.asistente && (
              <div className="result-banner-details">
                <div className="detail-item">
                  <span className="detail-label">Asistente:</span>
                  <strong className="detail-value">{validationResult.asistente.nombre}</strong>
                </div>

                {validationResult.asistente.categoria && (
                  <div className="detail-item">
                    <span className="detail-label">Categoría:</span>
                    <span className="category-badge">
                      {validationResult.asistente.categoria}
                    </span>
                  </div>
                )}

                <div className="detail-item">
                  <span className="detail-label">Boleto:</span>
                  <code className="detail-code">
                    {validationResult.asistente.ticketCode}
                  </code>
                </div>

                {validationResult.status === 'PERMITIDO' && (
                  <div className="detail-item wristband-alert">
                    <ShieldCheck size={18} />
                    <span>Entregar pulsera al asistente</span>
                  </div>
                )}
              </div>
            )}

            {validationResult.status === 'DENEGADO' && validationResult.horaFormateada && (
              <div className="result-duplicate-warning">
                <AlertTriangle size={18} />
                <span>
                  Boleto ingresó previamente a las <strong>{validationResult.horaFormateada}</strong>.
                </span>
              </div>
            )}
          </div>

          <button
            className="result-banner-close"
            onClick={() => setValidationResult(null)}
            title="Cerrar aviso"
            aria-label="Cerrar aviso"
          >
            <X size={20} />
          </button>
        </section>
      )}

      {/* Pestañas de modo operativo: Cámara QR vs Búsqueda manual */}
      <div className="gate-tabs-bar" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'camera'}
          className={`gate-tab-btn ${activeTab === 'camera' ? 'active' : ''}`}
          onClick={() => setActiveTab('camera')}
        >
          <QrCode size={18} />
          <span>Escanear con Cámara</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'manual'}
          className={`gate-tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
          onClick={() => setActiveTab('manual')}
        >
          <Search size={18} />
          <span>Búsqueda Manual / Sin QR</span>
        </button>
      </div>

      {/* Contenido según la pestaña activa */}
      <div className="gate-tab-panel">
        {activeTab === 'camera' ? (
          <QrCameraScanner
            onScan={handleValidate}
            disabled={validating || !evento.activo}
          />
        ) : (
          <ManualSearch
            eventoId={evento._id}
            onValidateCode={handleValidate}
            onWristbandToggled={() => fetchSummary()}
            disabled={validating}
          />
        )}
      </div>

      {!evento.activo && (
        <div className="alert error gate-inactive-warning" role="alert">
          El evento se encuentra actualmente marcado como inactivo. No se admitirán nuevos ingresos en puerta.
        </div>
      )}
    </div>
  );
}
