import { useEffect, useState } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Logo } from './Brand.jsx';
import LangSwitch from './LangSwitch.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import { can, initials } from '../lib/constants.js';

export default function Layout() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);

  const links = [
    { to: '/', icon: 'home', label: t('nav.dashboard'), end: true },
    { to: '/registros', icon: 'list', label: t('nav.records') },
    can(user, 'editor') && { to: '/registros/nuevo', icon: 'plus', label: t('nav.newRecord'), end: true },
    can(user, 'admin') && { to: '/usuarios', icon: 'users', label: t('nav.users') },
    can(user, 'admin') && { to: '/actividad', icon: 'clock', label: t('nav.activity') },
  ].filter((l) => l && !user?.mfaSetupRequired);

  return (
    <div className={`shell ${open ? 'open' : ''}`}>
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={() => setOpen(true)} aria-label={t('nav.menu')}>
          <Icon name="menu" size={22} />
        </button>
        <Link to="/" className="brand" style={{ padding: 0 }}>
          <Logo size={28} />
        </Link>
      </header>
      <div className="scrim" onClick={() => setOpen(false)} />
      <aside className="sidebar" aria-label="Panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/" className="brand">
            <Logo size={34} />
          </Link>
          {open && (
            <button type="button" className="icon-btn" style={{ color: '#fff' }} onClick={() => setOpen(false)} aria-label={t('nav.closeMenu')}>
              <Icon name="x" />
            </button>
          )}
        </div>
        <nav className="nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive && !(l.to === '/registros' && loc.pathname === '/registros/nuevo') ? 'active' : '')}>
              <Icon name={l.icon} size={19} />
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <LangSwitch />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Link to="/cuenta" className="user-chip" style={{ flex: 1, minWidth: 0 }}>
              <span className="avatar avatar-gold">{initials(user?.name)}</span>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</span>
                <span style={{ fontSize: 12, color: '#8cc5a6', fontWeight: 500 }}>{t(`roles.${user?.role}`)}</span>
              </span>
            </Link>
            <button type="button" className="icon-btn" style={{ color: '#cfe3d7', width: 44, height: 44 }} onClick={logout} aria-label={t('common.logout')} title={t('common.logout')}>
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>
      <main className="content" id="main">
        <ErrorBoundary resetKey={loc.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
