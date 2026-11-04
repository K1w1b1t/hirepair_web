'use client';
import { useEffect, useState } from 'react';
import {
  readHeaderProfile,
  saveHeaderProfile,
  type HeaderProfile as Profile,
} from '../_lib/engine-storage';
import { PROFILE_FIELDS } from '../_lib/resume-presentation';
const empty: Profile = { name: '', email: '', phone: '', confirmed: false };
export function HeaderProfile() {
  const [profile, setProfile] = useState(empty);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void readHeaderProfile()
      .then((saved) => {
        if (live && saved) setProfile(saved);
      })
      .catch(() => {
        if (live) setError('Não foi possível abrir os dados do cabeçalho.');
      });
    return () => {
      live = false;
    };
  }, []);
  async function save() {
    setBusy(true);
    setError('');
    try {
      const next = { ...profile, confirmed: true };
      await saveHeaderProfile(next);
      setProfile(next);
    } catch {
      setError('Não foi possível salvar os dados do cabeçalho.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>Nome e contatos opcionais</summary>
      <p>Estes dados ficam separados dos relatos, neste aparelho, e não são enviados à IA.</p>
      {PROFILE_FIELDS.map(([key, label]) => (
        <label key={key} htmlFor={`header-${key}`}>
          {label}
          <input
            id={`header-${key}`}
            maxLength={200}
            value={profile[key] ?? ''}
            disabled={busy}
            onChange={(event) =>
              setProfile({ ...profile, [key]: event.target.value, confirmed: false })
            }
          />
        </label>
      ))}
      <button className="button button-outline" disabled={busy} onClick={() => void save()}>
        Confirmar dados do cabeçalho
      </button>
      {profile.confirmed && <p role="status">Você confirmou estes dados.</p>}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
