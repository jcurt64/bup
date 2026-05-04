// Auth page — connexion / inscription, épurée
var { useState, useEffect } = React;
function Auth({ go }) {
  const [mode, setMode] = useState('signin'); // signin | signup
  const [profile, setProfile] = useState('prospect');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);

  const submit = (e) => {
    e?.preventDefault();
    if (mode === 'signup') {
      go(profile);
    } else {
      // Dummy routing: route based on email-heuristic, else prospect
      if (email.toLowerCase().includes('pro')) go('pro');
      else go('prospect');
    }
  };

  return (
    <div className="page auth-page">
      {/* Left — brand column */}
      <div className="auth-brand">
        <div className="row between center">
          <button onClick={() => go('landing')} className="row center gap-2" style={{ color: 'var(--paper)' }}>
            <Icon name="arrowLeft" size={14}/>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>Retour</span>
          </button>
          <Logo size={23} color="var(--paper)" onClick={() => go('landing')} />
        </div>

        <div>
          <div className="mono caps" style={{ color: 'rgba(255,255,255,.4)', marginBottom: 20 }}>— Bienvenue</div>
          <h2 className="serif auth-title" style={{ color: 'var(--paper)' }}>
            Vos données,<br/>
            <span className="italic" style={{ color: '#A5B4FC' }}>votre revenu.</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 16, maxWidth: 440, marginTop: 20, lineHeight: 1.6 }}>
            BUUPP est la première plateforme française où les professionnels rémunèrent
            directement les prospects qu'ils contactent. Double consentement, RGPD natif,
            retraits sous 48 heures.
          </p>
          <div style={{ marginTop: 40, borderTop: '1px solid rgba(255,255,255,.12)', paddingTop: 24 }}>
            {[
              ['2,4 M€', 'versés aux prospects'],
              ['48 000', 'mises en relation'],
              ['4 700', 'professionnels actifs'],
            ].map(([n, l], i) => (
              <div key={i} className="row between" style={{ padding: '10px 0', fontSize: 14 }}>
                <span style={{ color: 'rgba(255,255,255,.6)' }}>{l}</span>
                <span className="mono tnum" style={{ color: 'var(--paper)' }}>{n}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mono" style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', letterSpacing: '.14em' }}>
          RGPD NATIF · ISO/IEC 27001 EN COURS · HÉBERGÉ EN UE
        </div>
      </div>

      {/* Right — form column */}
      <div className="auth-form-col">
        <div style={{ maxWidth: 400, margin: '0 auto', width: '100%' }}>
          {/* Mode toggle */}
          <div className="row" style={{ padding: 4, border: '1px solid var(--line)', borderRadius: 999, width: 'fit-content', marginBottom: 32, background: 'var(--paper)' }}>
            {['signin', 'signup'].map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={mode === m ? 'btn-primary' : ''}
                style={{
                  padding: '6px 16px', borderRadius: 999, fontSize: 13,
                  background: mode === m ? 'var(--ink)' : 'transparent',
                  color: mode === m ? 'var(--paper)' : 'var(--ink-3)'
                }}>
                {m === 'signin' ? 'Connexion' : 'Inscription'}
              </button>
            ))}
          </div>

          <h3 className="serif auth-form-title" style={{ marginBottom: 8 }}>
            {mode === 'signin' ? 'Bon retour.' : 'Commençons.'}
          </h3>
          <p className="muted" style={{ fontSize: 14, marginBottom: 28 }}>
            {mode === 'signin' ? "Accédez à votre tableau de bord." : "Moins de 2 minutes pour créer votre compte."}
          </p>

          {/* Profile choice (signup only) */}
          {mode === 'signup' && (
            <div style={{ marginBottom: 20 }}>
              <div className="label">Je suis</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  ['prospect', 'Un prospect', 'Je monétise mes données'],
                  ['pro', 'Un professionnel', 'Je cherche des prospects'],
                ].map(([k, t, d]) => (
                  <button key={k} onClick={() => setProfile(k)} style={{
                    padding: 14, borderRadius: 10,
                    border: '1px solid ' + (profile === k ? 'var(--ink)' : 'var(--line-2)'),
                    background: profile === k ? 'var(--ivory-2)' : 'var(--paper)',
                    textAlign: 'left', transition: 'all .15s'
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{t}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{d}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Social */}
          <div className="row gap-2" style={{ marginBottom: 20 }}>
            {[
              {
                n: 'Google',
                icon: (
                  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
                    <path fill="#4285F4" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                    <path fill="#34A853" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                    <path fill="#FBBC05" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                    <path fill="#EA4335" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                  </svg>
                ),
              },
              {
                n: 'Apple',
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#000000" d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zM21.6 17.13c-.43 1-.95 1.99-1.6 2.85-.85 1.13-1.62 1.9-2.41 1.9-.78 0-1.27-.34-2.4-.34-1.08 0-1.59.34-2.39.34-.81 0-1.6-.83-2.46-1.93-1.46-1.85-2.6-5.27-1.06-7.6.93-1.39 2.49-2.27 4.13-2.27 1.06 0 2.07.62 2.74.62.6 0 1.92-.77 3.27-.65.56.02 2.16.22 3.18 1.7-.08.05-1.91 1.12-1.89 3.34.03 2.66 2.32 3.55 2.34 3.56-.02.06-.36 1.24-1.21 2.51z"/>
                  </svg>
                ),
              },
              {
                n: 'Facebook',
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                ),
              },
            ].map(({ n, icon }) => (
              <button key={n} onClick={submit} className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '10px', background: 'var(--paper)', gap: 8 }}>
                {icon}
                <span style={{ fontSize: 13 }}>{n}</span>
              </button>
            ))}
          </div>

          <div className="row center gap-3" style={{ margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }}/>
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-5)', letterSpacing: '.14em' }}>OU PAR EMAIL</span>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }}/>
          </div>

          <form onSubmit={submit}>
            <div style={{ marginBottom: 14 }}>
              <label className="label">Adresse email</label>
              <input className="input" type="email" required placeholder="vous@exemple.fr"
                value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <div className="row between" style={{ marginBottom: 6 }}>
                <label className="label" style={{ marginBottom: 0 }}>Mot de passe</label>
                {mode === 'signin' && <a className="muted" style={{ fontSize: 12 }} href="#">Oublié ?</a>}
              </div>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPw ? 'text' : 'password'} required placeholder="••••••••••"
                  value={pw} onChange={e => setPw(e.target.value)} style={{ paddingRight: 40 }}/>
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-5)' }}>
                  <Icon name={showPw ? 'eyeOff' : 'eye'} size={16}/>
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', marginTop: 22 }}>
              {mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
              <Icon name="arrow" size={14}/>
            </button>
          </form>

          <div className="muted" style={{ fontSize: 11, marginTop: 20, lineHeight: 1.6 }}>
            En continuant, vous acceptez les <a style={{ textDecoration: 'underline' }} href="#">CGU</a> et la{' '}
            <a style={{ textDecoration: 'underline' }} href="#">Politique RGPD</a>. BUUPP ne transmet
            aucune donnée sans votre consentement explicite préalable.
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Auth });
