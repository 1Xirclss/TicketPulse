import { useEffect, useRef, useState } from 'react';
import { Check, Edit2, Plus, RefreshCw, Settings, Tag, Ticket, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { api } from '../../utils/api';
import { money } from '../../utils/format';

export default function TariffManagerModal({ evento, onClose, onSaved }) {
  const [activeTab, setActiveTab] = useState('tarifas'); // 'tarifas' | 'categorias'
  const [tarifas, setTarifas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const formCardRef = useRef(null);

  // Formulario de Tarifa
  const [editingTariffId, setEditingTariffId] = useState(null);
  const [formNombre, setFormNombre] = useState('');
  const [formCategoria, setFormCategoria] = useState('General');
  const [formCustomCategoria, setFormCustomCategoria] = useState('');
  const [formEtapa, setFormEtapa] = useState('Preventa');
  const [formPrecio, setFormPrecio] = useState('');
  const [formActiva, setFormActiva] = useState(true);

  // Gestión de Categorías
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryPreventa, setNewCategoryPreventa] = useState('15.00');
  const [newCategoryPuerta, setNewCategoryPuerta] = useState('20.00');
  const [editingCategory, setEditingCategory] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  // Precios agrupados por categoría (Preventa y Puerta simultáneos)
  const [categoryPrices, setCategoryPrices] = useState({});

  // Cargar todas las tarifas (incluyendo inactivas para administradores)
  async function loadTarifas() {
    if (!evento?._id) return;
    setLoading(true);
    setError('');
    try {
      const data = await api(`/tarifas?evento=${evento._id}&all=true`);
      setTarifas(data.tarifas || []);
    } catch (err) {
      setError(err.message || 'Error al cargar tarifas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTarifas();
  }, [evento?._id]);

  // Obtener lista única de categorías actuales
  const existingCategories = Array.from(
    new Set(['General', 'Promo', ...tarifas.map(t => t.categoria)])
  ).filter(Boolean);

  // Sincronizar mapa de precios por categoría al cargar o actualizar tarifas
  useEffect(() => {
    const map = {};
    existingCategories.forEach(cat => {
      const prev = tarifas.find(t => t.categoria === cat && t.etapa === 'Preventa');
      const puer = tarifas.find(t => t.categoria === cat && t.etapa === 'Puerta');
      map[cat] = {
        preventaPrice: prev ? (prev.precioCentavos / 100).toFixed(2) : '15.00',
        preventaActiva: prev ? prev.activa : true,
        puertaPrice: puer ? (puer.precioCentavos / 100).toFixed(2) : '20.00',
        puertaActiva: puer ? puer.activa : true,
        hasPreventa: !!prev,
        hasPuerta: !!puer
      };
    });
    setCategoryPrices(map);
  }, [tarifas]);

  // Iniciar edición de una tarifa existente
  function startEditTariff(tarifa) {
    setEditingTariffId(tarifa._id);
    setFormNombre(tarifa.nombre);
    setFormCategoria(tarifa.categoria);
    setFormCustomCategoria('');
    setFormEtapa(tarifa.etapa);
    setFormPrecio((tarifa.precioCentavos / 100).toFixed(2));
    setFormActiva(tarifa.activa);
    setNotice('');
    formCardRef.current?.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => document.getElementById('tariff-price')?.focus(), 150);
  }

  // Cancelar edición o limpiar para nueva tarifa
  function resetTariffForm() {
    setEditingTariffId(null);
    setFormNombre('');
    setFormCategoria(existingCategories[0] || 'General');
    setFormCustomCategoria('');
    setFormEtapa('Preventa');
    setFormPrecio('');
    setFormActiva(true);
    formCardRef.current?.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => document.getElementById('tariff-name')?.focus(), 150);
  }

  // Guardar Tarifa (Crear o Actualizar)
  async function handleSubmitTariff(e) {
    e.preventDefault();
    setError('');
    setNotice('');

    const finalCategoria = formCategoria === '__NEW__' ? formCustomCategoria.trim() : formCategoria.trim();
    if (!formNombre.trim()) {
      setError('El nombre de la tarifa es obligatorio.');
      return;
    }
    if (!finalCategoria) {
      setError('La categoría es obligatoria.');
      return;
    }
    const precioNum = parseFloat(formPrecio);
    if (isNaN(precioNum) || precioNum < 0) {
      setError('Ingresa un precio válido (mayor o igual a cero).');
      return;
    }

    const precioCentavos = Math.round(precioNum * 100);
    setBusy(true);

    try {
      if (editingTariffId) {
        // Actualizar existente
        await api(`/tarifas/${editingTariffId}`, {
          method: 'PUT',
          body: {
            nombre: formNombre.trim(),
            categoria: finalCategoria,
            etapa: formEtapa,
            precioCentavos,
            activa: formActiva
          }
        });
        setNotice(`Tarifa "${formNombre}" actualizada correctamente.`);
      } else {
        // Crear nueva
        await api('/tarifas', {
          method: 'POST',
          body: {
            eventoId: evento._id,
            nombre: formNombre.trim(),
            categoria: finalCategoria,
            etapa: formEtapa,
            precioCentavos,
            activa: formActiva
          }
        });
        setNotice(`Tarifa "${formNombre}" creada correctamente.`);
      }

      resetTariffForm();
      await loadTarifas();
      if (onSaved) onSaved();
    } catch (err) {
      setError(err.message || 'Error al guardar la tarifa');
    } finally {
      setBusy(false);
    }
  }

  // Alternar estado activo / inactivo de una tarifa
  async function toggleTariffActive(tarifa) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`/tarifas/${tarifa._id}`, {
        method: 'PUT',
        body: { activa: !tarifa.activa }
      });
      await loadTarifas();
      if (onSaved) onSaved();
    } catch (err) {
      setError(err.message || 'Error al alternar estado de tarifa');
    } finally {
      setBusy(false);
    }
  }

  // Guardar a la vez precios de Preventa y Puerta para una categoría
  async function handleSaveCategoryPrices(cat) {
    const data = categoryPrices[cat];
    if (!data) return;

    const prevNum = parseFloat(data.preventaPrice);
    const puerNum = parseFloat(data.puertaPrice);

    if (isNaN(prevNum) || prevNum < 0 || isNaN(puerNum) || puerNum < 0) {
      setError('Ingresa precios válidos para Preventa y Puerta (0 o mayores).');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api('/tarifas/categorias/precios', {
        method: 'PUT',
        body: {
          eventoId: evento._id,
          categoria: cat,
          precioPreventaCentavos: Math.round(prevNum * 100),
          precioPuertaCentavos: Math.round(puerNum * 100),
          activaPreventa: data.preventaActiva !== false,
          activaPuerta: data.puertaActiva !== false
        }
      });
      setNotice(`Tarifas de Preventa ($${prevNum.toFixed(2)}) y Puerta ($${puerNum.toFixed(2)}) guardadas correctamente para "${cat}".`);
      await loadTarifas();
      if (onSaved) onSaved();
    } catch (err) {
      setError(err.message || 'Error al guardar tarifas por categoría');
    } finally {
      setBusy(false);
    }
  }

  // Crear categoría nueva desde la pestaña de categorías (con Preventa y Puerta)
  async function handleAddCategory(e) {
    e.preventDefault();
    const cat = newCategoryName.trim();
    if (!cat) return;
    if (existingCategories.some(c => c.toLowerCase() === cat.toLowerCase())) {
      setError(`La categoría "${cat}" ya existe.`);
      return;
    }

    const prevNum = parseFloat(newCategoryPreventa) || 15;
    const puerNum = parseFloat(newCategoryPuerta) || 20;

    setBusy(true);
    setError('');
    try {
      await api('/tarifas/categorias/precios', {
        method: 'PUT',
        body: {
          eventoId: evento._id,
          categoria: cat,
          precioPreventaCentavos: Math.round(prevNum * 100),
          precioPuertaCentavos: Math.round(puerNum * 100),
          activaPreventa: true,
          activaPuerta: true
        }
      });
      setNewCategoryName('');
      setNewCategoryPreventa('15.00');
      setNewCategoryPuerta('20.00');
      setNotice(`Categoría "${cat}" creada con su tarifa correspondiente.`);
      await loadTarifas();
      if (onSaved) onSaved();
    } catch (err) {
      setError(err.message || 'Error creando categoría');
    } finally {
      setBusy(false);
    }
  }

  // Renombrar categoría existente
  async function handleRenameCategory(categoriaAnterior) {
    const nueva = renameValue.trim();
    if (!nueva || nueva === categoriaAnterior) {
      setEditingCategory(null);
      return;
    }

    setBusy(true);
    setError('');
    try {
      const res = await api('/tarifas/categorias/renombrar', {
        method: 'PUT',
        body: {
          eventoId: evento._id,
          categoriaAnterior,
          categoriaNueva: nueva
        }
      });
      setNotice(`Categoría renombrada a "${nueva}" (${res.tarifasActualizadas} tarifas actualizadas).`);
      setEditingCategory(null);
      setRenameValue('');
      await loadTarifas();
      if (onSaved) onSaved();
    } catch (err) {
      setError(err.message || 'Error al renombrar categoría');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="tariff-modal-title">
      <div className="tariff-manager-dialog">
        <header className="dialog-header">
          <div>
            <div className="dialog-eyebrow">ADMINISTRACIÓN OFICIAL</div>
            <h2 id="tariff-modal-title">Gestión de Tarifas y Categorías</h2>
            <p className="dialog-subtitle">
              Configura precios, etapas y categorías de acceso para <strong>{evento.nombre}</strong>.
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar modal" title="Cerrar">
            <X size={20} />
          </button>
        </header>

        {notice && <div className="alert success" role="status">{notice}</div>}
        {error && <div className="alert error" role="alert">{error}</div>}

        {/* Selector de pestañas */}
        <div className="tariff-modal-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'tarifas'}
            className={`tariff-tab-btn ${activeTab === 'tarifas' ? 'active' : ''}`}
            onClick={() => setActiveTab('tarifas')}
          >
            <Ticket size={17} />
            <span>Tarifas Oficiales ({tarifas.length})</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'categorias'}
            className={`tariff-tab-btn ${activeTab === 'categorias' ? 'active' : ''}`}
            onClick={() => setActiveTab('categorias')}
          >
            <Tag size={17} />
            <span>Categorías del Evento ({existingCategories.length})</span>
          </button>
        </div>

        {/* Pestaña 1: Tarifas */}
        {activeTab === 'tarifas' && (
          <div className="tariff-tab-content">
            {/* Sección de Tarificación por Categoría (Preventa y Puerta a la vez) */}
            <section className="category-pricing-section">
              <div className="section-title-wrap">
                <h3>Tarifas Oficiales por Categoría</h3>
                <p className="section-note">
                  Configura y guarda el precio de <strong>Preventa</strong> y <strong>Puerta</strong> para cada categoría al mismo tiempo.
                </p>
              </div>

              <div className="category-pricing-cards">
                {existingCategories.map(cat => {
                  const p = categoryPrices[cat] || {
                    preventaPrice: '15.00',
                    puertaPrice: '20.00',
                    preventaActiva: true,
                    puertaActiva: true
                  };
                  return (
                    <div key={cat} className="category-pricing-card">
                      <div className="cat-card-header">
                        <span className="category-badge">{cat}</span>
                        <span className="cat-hint">2 etapas de venta</span>
                      </div>

                      <div className="cat-stages-grid">
                        {/* Columna Preventa */}
                        <div className={`stage-pricing-box ${!p.preventaActiva ? 'is-inactive' : ''}`}>
                          <div className="stage-pricing-label">
                            <Ticket size={15} />
                            <strong>Preventa</strong>
                          </div>
                          <div className="price-input-wrap">
                            <span className="currency-prefix">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              aria-label={`Precio Preventa ${cat}`}
                              value={p.preventaPrice}
                              onChange={e => {
                                const val = e.target.value;
                                setCategoryPrices(prev => ({
                                  ...prev,
                                  [cat]: { ...prev[cat], preventaPrice: val }
                                }));
                              }}
                              disabled={busy}
                            />
                          </div>
                          <label className="stage-active-toggle">
                            <input
                              type="checkbox"
                              checked={p.preventaActiva}
                              onChange={e => {
                                const checked = e.target.checked;
                                setCategoryPrices(prev => ({
                                  ...prev,
                                  [cat]: { ...prev[cat], preventaActiva: checked }
                                }));
                              }}
                              disabled={busy}
                            />
                            <span>{p.preventaActiva ? 'Activa' : 'Inactiva'}</span>
                          </label>
                        </div>

                        {/* Columna Puerta */}
                        <div className={`stage-pricing-box ${!p.puertaActiva ? 'is-inactive' : ''}`}>
                          <div className="stage-pricing-label">
                            <Tag size={15} />
                            <strong>Puerta</strong>
                          </div>
                          <div className="price-input-wrap">
                            <span className="currency-prefix">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              aria-label={`Precio Puerta ${cat}`}
                              value={p.puertaPrice}
                              onChange={e => {
                                const val = e.target.value;
                                setCategoryPrices(prev => ({
                                  ...prev,
                                  [cat]: { ...prev[cat], puertaPrice: val }
                                }));
                              }}
                              disabled={busy}
                            />
                          </div>
                          <label className="stage-active-toggle">
                            <input
                              type="checkbox"
                              checked={p.puertaActiva}
                              onChange={e => {
                                const checked = e.target.checked;
                                setCategoryPrices(prev => ({
                                  ...prev,
                                  [cat]: { ...prev[cat], puertaActiva: checked }
                                }));
                              }}
                              disabled={busy}
                            />
                            <span>{p.puertaActiva ? 'Activa' : 'Inactiva'}</span>
                          </label>
                        </div>
                      </div>

                      <div className="cat-card-actions">
                        <button
                          type="button"
                          className="primary-button compact full-width"
                          onClick={() => handleSaveCategoryPrices(cat)}
                          disabled={busy}
                        >
                          <Check size={14} /> Guardar Precios de {cat}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
            {/* Formulario de Crear / Editar Tarifa */}
            <form ref={formCardRef} className="tariff-form-card" onSubmit={handleSubmitTariff}>
              <div className="form-card-header">
                <div>
                  <span className={`form-mode-badge ${editingTariffId ? 'editing' : 'creating'}`}>
                    {editingTariffId ? 'MODO EDICIÓN' : 'NUEVA TARIFA'}
                  </span>
                  <h3>{editingTariffId ? 'Modificar Tarifa Existente' : 'Agregar Nueva Tarifa'}</h3>
                </div>
                {editingTariffId && (
                  <button type="button" className="secondary-button compact" onClick={resetTariffForm}>
                    <Plus size={14} /> Crear nueva tarifa en su lugar
                  </button>
                )}
              </div>

              <div className="tariff-form-grid">
                <div className="field-group">
                  <label htmlFor="tariff-name">Nombre de Tarifa</label>
                  <input
                    id="tariff-name"
                    type="text"
                    placeholder="Ej: General, VIP, Estudiantes…"
                    value={formNombre}
                    onChange={e => setFormNombre(e.target.value)}
                    required
                  />
                </div>

                <div className="field-group">
                  <label htmlFor="tariff-category">Categoría</label>
                  <select
                    id="tariff-category"
                    value={formCategoria}
                    onChange={e => setFormCategoria(e.target.value)}
                    required
                  >
                    <option value="">Selecciona una categoría…</option>
                    {existingCategories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="__NEW__">➕ Crear nueva categoría…</option>
                  </select>
                </div>

                {formCategoria === '__NEW__' && (
                  <div className="field-group full-row">
                    <label htmlFor="tariff-custom-cat">Nombre de la Nueva Categoría</label>
                    <input
                      id="tariff-custom-cat"
                      type="text"
                      placeholder="Ej: VIP, Gold, Invitado Especial…"
                      value={formCustomCategoria}
                      onChange={e => setFormCustomCategoria(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="field-group">
                  <label htmlFor="tariff-stage">Etapa de Venta</label>
                  <select
                    id="tariff-stage"
                    value={formEtapa}
                    onChange={e => setFormEtapa(e.target.value)}
                    required
                  >
                    <option value="Preventa">Preventa</option>
                    <option value="Puerta">Puerta</option>
                  </select>
                </div>

                <div className="field-group">
                  <label htmlFor="tariff-price">Precio en USD ($)</label>
                  <div className="price-input-wrap">
                    <span className="currency-prefix">$</span>
                    <input
                      id="tariff-price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formPrecio}
                      onChange={e => setFormPrecio(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="tariff-form-actions">
                <button type="submit" className="primary-button" disabled={busy}>
                  <Check size={16} />
                  {editingTariffId ? 'Guardar Cambios' : 'Crear Tarifa'}
                </button>
              </div>
            </form>

            {/* Listado de tarifas */}
            <div className="tariff-list-section">
              <div className="tariff-list-header">
                <div>
                  <h3>Tarifas Registradas ({tarifas.length})</h3>
                  <p className="section-note">Precios y categorías vigentes para este evento.</p>
                </div>
                <button
                  type="button"
                  className="primary-button compact"
                  onClick={resetTariffForm}
                >
                  <Plus size={15} /> Agregar otra tarifa
                </button>
              </div>
              {loading ? (
                <div className="tariff-loading"><span className="spinner" /> Cargando tarifas…</div>
              ) : !tarifas.length ? (
                <div className="inline-empty">
                  <Ticket size={28} />
                  <p>No hay tarifas configuradas para este evento.</p>
                </div>
              ) : (
                <div className="tariff-table-wrap">
                  <table className="tariff-table">
                    <thead>
                      <tr>
                        <th>Tarifa</th>
                        <th>Categoría</th>
                        <th>Etapa</th>
                        <th>Precio</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tarifas.map(t => (
                        <tr key={t._id} className={!t.activa ? 'inactive-row' : ''}>
                          <td><strong>{t.nombre}</strong></td>
                          <td><span className="category-badge">{t.categoria}</span></td>
                          <td>{t.etapa}</td>
                          <td className="mono">{money(t.precioCentavos)}</td>
                          <td>
                            <button
                              type="button"
                              className={`status-toggle-btn ${t.activa ? 'active' : 'inactive'}`}
                              onClick={() => toggleTariffActive(t)}
                              title={t.activa ? 'Desactivar tarifa' : 'Activar tarifa'}
                              disabled={busy}
                            >
                              {t.activa ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                              <span>{t.activa ? 'Activa' : 'Inactiva'}</span>
                            </button>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() => startEditTariff(t)}
                              title="Editar tarifa"
                              aria-label={`Editar ${t.nombre}`}
                            >
                              <Edit2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pestaña 2: Categorías */}
        {activeTab === 'categorias' && (
          <div className="tariff-tab-content">
            {/* Formulario rápida de nueva categoría con Preventa y Puerta */}
            <form className="category-form-card" onSubmit={handleAddCategory}>
              <h3>Agregar Nueva Categoría (Preventa y Puerta simultáneas)</h3>
              <p className="section-note">
                Crea la categoría con sus tarifas oficiales de Preventa y Puerta listas para vender.
              </p>
              <div className="category-add-row" style={{ marginTop: '12px' }}>
                <input
                  type="text"
                  placeholder="Ej: VIP, Platinum, Cortesía, Estudiante…"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  required
                />
                <button type="submit" className="primary-button compact" disabled={busy || !newCategoryName.trim()}>
                  <Plus size={16} /> Crear Categoría
                </button>
              </div>
              <div className="tariff-form-grid" style={{ marginTop: '12px' }}>
                <div className="field-group">
                  <label htmlFor="cat-new-preventa">Precio Preventa en USD ($)</label>
                  <div className="price-input-wrap">
                    <span className="currency-prefix">$</span>
                    <input
                      id="cat-new-preventa"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="15.00"
                      value={newCategoryPreventa}
                      onChange={e => setNewCategoryPreventa(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="field-group">
                  <label htmlFor="cat-new-puerta">Precio Puerta en USD ($)</label>
                  <div className="price-input-wrap">
                    <span className="currency-prefix">$</span>
                    <input
                      id="cat-new-puerta"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="20.00"
                      value={newCategoryPuerta}
                      onChange={e => setNewCategoryPuerta(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
            </form>

            {/* Listado de categorías */}
            <div className="category-list-section">
              <h3>Categorías Actuales del Evento</h3>
              <p className="section-note">
                Al renombrar una categoría, se actualizarán automáticamente todas las tarifas y registros asociados.
              </p>

              <div className="category-items-grid">
                {existingCategories.map(cat => (
                  <div key={cat} className="category-manage-item">
                    {editingCategory === cat ? (
                      <div className="category-rename-row">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="primary-button compact"
                          onClick={() => handleRenameCategory(cat)}
                          disabled={busy}
                        >
                          <Check size={14} /> Guardar
                        </button>
                        <button
                          type="button"
                          className="secondary-button compact"
                          onClick={() => setEditingCategory(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="category-item-info">
                          <Tag size={16} className="category-icon" />
                          <strong className="category-name">{cat}</strong>
                        </div>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => {
                            setEditingCategory(cat);
                            setRenameValue(cat);
                          }}
                          title={`Renombrar categoría ${cat}`}
                          aria-label={`Renombrar categoría ${cat}`}
                        >
                          <Edit2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <footer className="dialog-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}
