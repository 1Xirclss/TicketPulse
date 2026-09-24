import { useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, Clock, Search, Ticket, UserCheck, X } from 'lucide-react';
import { api } from '../../utils/api';

export default function ManualSearch({ eventoId, onValidateCode, onWristbandToggled, disabled = false }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const inputRef = useRef(null);

  // Auto-enfocar el campo de búsqueda al montar para lectores de códigos de barra USB/Bluetooth
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Búsqueda en vivo con debounce de 250ms
  useEffect(() => {
    const q = searchTerm.trim();
    if (!q || !eventoId) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setSearchError('');
      try {
        const data = await api(`/puerta/buscar?evento=${eventoId}&q=${encodeURIComponent(q)}`, {
          signal: controller.signal
        });
        setResults(data.resultados || []);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setSearchError('Error al buscar asistentes: ' + (err.message || ''));
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchTerm, eventoId]);

  // Si el usuario presiona Enter en el input:
  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = searchTerm.trim();
      if (!code) return;

      // Si parece un ticket code o hay un resultado exacto
      if (results.length === 1) {
        onValidateCode(results[0].ticketCode);
        setSearchTerm('');
      } else if (code.toUpperCase().startsWith('NX') || code.toUpperCase().startsWith('NEXO:')) {
        onValidateCode(code);
        setSearchTerm('');
      }
    }
  }

  // Alternar entrega de pulsera
  async function togglePulsera(asistente) {
    if (updatingId || disabled) return;
    setUpdatingId(asistente.id);
    try {
      const nextState = !asistente.pulseraEntregada;
      await api(`/puerta/marcar-pulsera/${asistente.id}`, {
        method: 'PUT',
        body: { pulseraEntregada: nextState }
      });
      // Actualizar estado local
      setResults(prev => prev.map(item => item.id === asistente.id ? { ...item, pulseraEntregada: nextState } : item));
      if (onWristbandToggled) {
        onWristbandToggled(asistente.id, nextState);
      }
    } catch (err) {
      setSearchError('No se pudo actualizar la pulsera: ' + (err.message || ''));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="gate-manual-search-box">
      <div className="manual-search-input-wrap">
        <Search size={20} className="search-icon" />
        <label htmlFor="gate-manual-input" className="sr-only">
          Buscar asistente o escanear código
        </label>
        <input
          id="gate-manual-input"
          ref={inputRef}
          type="text"
          className="gate-search-field"
          placeholder="Nombre, teléfono, colegio o código de boleto…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoComplete="off"
        />
        {searchTerm && (
          <button
            className="icon-button clear-button"
            onClick={() => {
              setSearchTerm('');
              setResults([]);
              inputRef.current?.focus();
            }}
            title="Limpiar búsqueda"
            aria-label="Limpiar búsqueda"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="manual-search-hint">
        <span>💡 Compatible con pistolas láser USB/Bluetooth (presiona Enter automático).</span>
      </div>

      {searchError && (
        <div className="alert error" role="alert">
          {searchError}
        </div>
      )}

      {loading && (
        <div className="manual-search-loading" role="status">
          <span className="spinner" /> Buscando asistentes en tiempo real…
        </div>
      )}

      {!loading && searchTerm.trim() && !results.length && (
        <div className="manual-search-empty">
          <Ticket size={28} />
          <p>No se encontraron asistentes para "{searchTerm}".</p>
          <small>Verifica la ortografía o intenta buscar por teléfono o código.</small>
        </div>
      )}

      {!loading && !searchTerm.trim() && (
        <div className="manual-search-guide">
          <UserCheck size={32} />
          <h3>Ingreso manual sin código QR</h3>
          <p>
            Si el asistente tiene la pantalla rota, no tiene batería o lleva boleto impreso,
            búscalo aquí por su nombre o teléfono para marcar su ingreso en 1 clic.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="manual-search-results-list">
          {results.map((asistente) => {
            const isFull = asistente.ingresado || (asistente.ingresados >= asistente.cantidad);
            const canValidate = !isFull && asistente.pagado;

            return (
              <div key={asistente.id} className={`manual-result-card ${isFull ? 'fully-entered' : ''}`}>
                <div className="result-main-info">
                  <div className="result-header-row">
                    <strong className="result-name">{asistente.nombre}</strong>
                    <span className={`category-badge ${asistente.categoria === 'Promo' ? 'promo' : ''}`}>
                      {asistente.categoria}
                    </span>
                    {!asistente.pagado && (
                      <span className="payment-badge pending">Pendiente pago</span>
                    )}
                  </div>

                  <div className="result-meta-row">
                    <code className="result-ticket-code">{asistente.ticketCode}</code>
                    {asistente.colegio && <span className="meta-item">🏫 {asistente.colegio}</span>}
                    {asistente.telefono && <span className="meta-item">📞 {asistente.telefono}</span>}
                  </div>

                  <div className="result-status-row">
                    <span className={`gate-status-pill ${isFull ? 'status-entered' : 'status-pending'}`}>
                      {isFull ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                      {isFull ? 'Ingresado completo' : 'Pendiente de ingreso'}
                      {' '}({asistente.ingresados}/{asistente.cantidad})
                    </span>

                    <button
                      type="button"
                      className={`wristband-toggle-button ${asistente.pulseraEntregada ? 'delivered' : ''}`}
                      onClick={() => togglePulsera(asistente)}
                      disabled={updatingId === asistente.id || disabled}
                      title="Alternar estado de entrega de pulsera"
                    >
                      <Check size={13} />
                      {asistente.pulseraEntregada ? 'Pulsera entregada' : 'Entregar pulsera'}
                    </button>
                  </div>
                </div>

                <div className="result-actions">
                  <button
                    className={`primary-button compact gate-admit-button ${isFull ? 'already-done' : ''}`}
                    disabled={!canValidate || disabled}
                    onClick={() => onValidateCode(asistente.ticketCode)}
                  >
                    <UserCheck size={16} />
                    {isFull ? 'Completado' : 'Marcar Ingreso'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
