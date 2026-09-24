import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Mail, LockKeyhole, UserRound, KeyRound, ShieldCheck } from 'lucide-react';
import AuthLayout from '../components/layout/AuthLayout';
import Field from '../components/auth/Field';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';

export default function AuthPage({ mode }) {
  const { user, authenticate } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resetStep, setResetStep] = useState(false);
  const [registerStep, setRegisterStep] = useState(false);
  const [correo, setCorreo] = useState('');
  const [rol, setRol] = useState('Taquilla');

  const register = mode === 'register';
  const recovery = mode === 'recovery';

  useEffect(() => {
    setError('');
    setNotice('');
    setResetStep(false);
    setRegisterStep(false);
  }, [mode]);

  if (user) {
    const dest = user.rol === 'Portero' ? '/puerta' : user.rol === 'Taquilla' ? '/ventas' : '/';
    return <Navigate to={dest} replace />;
  }

  const title = register
    ? registerStep
      ? 'Verifica tu correo.'
      : 'Tu equipo empieza aquí.'
    : recovery
    ? resetStep
      ? 'Recupera tu acceso.'
      : 'Volvamos a conectarte.'
    : 'Bienvenido de nuevo.';

  const description = register
    ? registerStep
      ? `Ingresa el código de 6 dígitos que enviamos a ${correo} para activar tu cuenta.`
      : 'Crea tu cuenta con credenciales seguras y verifica tu correo.'
    : recovery
    ? resetStep
      ? 'Ingresa el código de tu correo y elige una nueva contraseña.'
      : 'Te enviaremos un código para restablecer tu contraseña.'
    : 'Ingresa tus credenciales para continuar a tu espacio de trabajo.';

  async function submit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (values.confirmarPassword !== undefined && values.password !== values.confirmarPassword) {
        throw new Error('Las contraseñas no coinciden.');
      }
      if (recovery) {
        const result = await api(resetStep ? '/auth/reset-password' : '/auth/forgot-password', {
          method: 'POST',
          body: { ...values, correo }
        });
        setNotice(result.message);
        if (resetStep) {
          setResetStep(false);
          setCorreo('');
        } else {
          setResetStep(true);
        }
      } else if (register) {
        if (!registerStep) {
          const result = await api('/auth/register-request', {
            method: 'POST',
            body: { ...values, correo }
          });
          setNotice(result.message + (result.devCode ? ` [Código de desarrollo: ${result.devCode}]` : ''));
          setRegisterStep(true);
        } else {
          const result = await authenticate('register-verify', { correo, otp: values.otp });
          setNotice(result?.message || 'Cuenta activada correctamente.');
          const target = result?.user?.rol === 'Portero' ? '/puerta' : result?.user?.rol === 'Taquilla' ? '/ventas' : '/';
          navigate(target, { replace: true });
        }
      } else {
        const result = await authenticate('login', { ...values, recordar: values.recordar === 'on' });
        const target = result?.user?.rol === 'Portero' ? '/puerta' : result?.user?.rol === 'Taquilla' ? '/ventas' : '/';
        navigate(target, { replace: true });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <div className="form-symbol">
        <KeyRound size={25} />
        <span className="symbol-spark" />
      </div>
      <div className="eyebrow form-eyebrow">
        {register ? 'ÚNETE A TU ORGANIZACIÓN' : recovery ? 'RECUPERACIÓN DE CUENTA' : 'TU PRÓXIMO GRAN EVENTO EMPIEZA AQUÍ'}
      </div>
      <h2>{title}</h2>
      <p className="form-description">{description}</p>

      <form onSubmit={submit} className="auth-form">
        {error && <div className="alert error" role="alert">{error}</div>}
        {notice && <div className="alert success" role="status">{notice}</div>}
        <fieldset disabled={busy}>
          {register && !registerStep && (
            <Field
              label="Nombre completo"
              name="nombre"
              icon={UserRound}
              placeholder="Tu nombre y apellido"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
            />
          )}

          <Field
            label="Correo electrónico"
            name="correo"
            type="email"
            icon={Mail}
            placeholder="nombre@organizacion.com"
            required
            maxLength={254}
            autoComplete="email"
            value={correo}
            onChange={e => setCorreo(e.target.value)}
            readOnly={(recovery && resetStep) || (register && registerStep)}
          />

          {((recovery && resetStep) || (register && registerStep)) && (
            <Field
              label="Código de verificación"
              name="otp"
              icon={ShieldCheck}
              placeholder="000000"
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              autoComplete="one-time-code"
            />
          )}

          {(!register || !registerStep) && (!recovery || resetStep) && (
            <Field
              label={recovery ? 'Nueva contraseña' : 'Contraseña'}
              name="password"
              type="password"
              icon={LockKeyhole}
              placeholder={register || recovery ? 'Al menos 12 caracteres' : 'Ingresa tu contraseña'}
              required
              minLength={register || recovery ? 12 : 1}
              maxLength={72}
              autoComplete={register || recovery ? 'new-password' : 'current-password'}
            />
          )}

          {((register && !registerStep) || (recovery && resetStep)) && (
            <Field
              label="Confirmar contraseña"
              name="confirmarPassword"
              type="password"
              icon={LockKeyhole}
              placeholder="Repite tu contraseña"
              required
              minLength={12}
              maxLength={72}
              autoComplete="new-password"
            />
          )}

          {register && !registerStep && (
            <>
              <div className="field">
                <label htmlFor="rol">Rol en el equipo</label>
                <select id="rol" name="rol" value={rol} onChange={e => setRol(e.target.value)}>
                  <option value="Admin">Admin (Control Total)</option>
                  <option value="Taquilla">Taquilla (Ventas y Asistentes)</option>
                  <option value="Portero">Portero (Control en Puerta)</option>
                </select>
              </div>
              <Field
                label={rol === 'Admin' ? 'Clave de organización · administradores' : 'Clave de organización · equipo'}
                name="claveOrganizacion"
                type="password"
                icon={KeyRound}
                placeholder="Solicítala al administrador"
                required
                autoComplete="off"
              />
              <p className="input-help">La clave de invitación autoriza tu acceso al equipo con este rol.</p>
            </>
          )}

          {!register && !recovery && (
            <div className="form-options">
              <label className="checkbox">
                <input type="checkbox" name="recordar" /> Recordarme
              </label>
              <Link to="/recuperar">¿Olvidaste tu contraseña?</Link>
            </div>
          )}

          <button className="primary-button" disabled={busy} type="submit">
            {busy ? (
              <>
                <span className="spinner" /> Procesando…
              </>
            ) : (
              <>
                {register
                  ? registerStep
                    ? 'Verificar y activar cuenta'
                    : 'Enviar código de verificación'
                  : recovery
                  ? resetStep
                    ? 'Actualizar contraseña'
                    : 'Enviar código de recuperación'
                  : 'Iniciar sesión'}
                <ArrowRight size={19} />
              </>
            )}
          </button>
        </fieldset>
      </form>

      {register && registerStep && (
        <div className="recovery-links">
          <button
            className="text-button"
            onClick={() => {
              setRegisterStep(false);
              setNotice('');
              setError('');
            }}
          >
            <ArrowLeft size={15} /> Modificar datos de registro
          </button>
        </div>
      )}

      {recovery ? (
        <div className="recovery-links">
          <Link to="/login">
            <ArrowLeft size={15} /> Volver a iniciar sesión
          </Link>
          {resetStep && (
            <button
              className="text-button"
              onClick={() => {
                setResetStep(false);
                setNotice('');
                setError('');
              }}
            >
              Solicitar otro código
            </button>
          )}
        </div>
      ) : (
        !registerStep && (
          <>
            <div className="divider">
              <span /> TU EQUIPO, EN UN SOLO LUGAR <span />
            </div>
            <p className="switch-form">
              {register ? '¿Ya tienes una cuenta?' : '¿Primera vez en TicketPulse?'}{' '}
              <Link to={register ? '/login' : '/registro'}>
                {register ? 'Inicia sesión' : 'Crear una cuenta'} <ArrowUp />
              </Link>
            </p>
          </>
        )
      )}

      <div className="security-note">
        <span className="security-icon">
          <ShieldCheck size={19} />
        </span>
        <p>
          <strong>Un espacio para tu organización</strong>
          <span>Acceso por roles. Conexiones que hacen que todo suceda.</span>
        </p>
      </div>
    </AuthLayout>
  );
}

function ArrowUp() {
  return <span aria-hidden="true">↗</span>;
}
