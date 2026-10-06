import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { GUIDE } from '../guide';

// Guide — plain-language definitions of every number in Analytics, and how each is calculated.
export default function Guide({ state, update }) {
  const [q, setQ] = useState('');
  const focus = state.params.get('g');
  const sections = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return GUIDE;
    return GUIDE.map(s => ({ ...s, entries: s.entries.filter(e => [e.term, e.what, e.how, e.note].join(' ').toLowerCase().includes(term)) }))
      .filter(s => s.entries.length);
  }, [q]);

  useEffect(() => {
    if (!focus) return;
    const el = document.getElementById(`guide-${focus}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focus]);

  return (
    <div className="an-guide">
      <aside className="an-guide-nav">
        <label className="sp-search an-search"><Search size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search the guide" aria-label="Search the guide" /></label>
        <nav aria-label="Guide sections">
          {GUIDE.map(s => (
            <div key={s.id}>
              <a href={`#guide-section-${s.id}`}>{s.title}</a>
              <ul>{s.entries.map(e => <li key={e.id}><button type="button" aria-current={focus === e.id || undefined} onClick={() => { setQ(''); update({ g: e.id }); }}>{e.term}</button></li>)}</ul>
            </div>
          ))}
        </nav>
      </aside>
      <div className="an-guide-body">
        <section className="sp-surface an-guide-intro">
          <span className="sp-integration-icon"><BookOpen size={19} /></span>
          <div><strong>How to read Stealth analytics</strong>
            <p>Every number on these tabs, in plain language: what it means, exactly how it is calculated, and what to watch out for. Hover a card on the Overview for a one-line definition, or use the <b>?</b> on any panel to jump here.</p></div>
        </section>
        {sections.length === 0 && <div className="sp-surface an-state">Nothing matches “{q}”.</div>}
        {sections.map(s => (
          <section key={s.id} id={`guide-section-${s.id}`} className="sp-surface an-guide-section">
            <h2>{s.title}</h2>
            {s.intro && <p className="an-guide-lead">{s.intro}</p>}
            <dl>
              {s.entries.map(e => (
                <div key={e.id} id={`guide-${e.id}`} className="an-guide-entry" data-focus={focus === e.id || undefined}>
                  <dt>{e.term}</dt>
                  <dd>
                    <p>{e.what}</p>
                    {e.how && <p className="an-guide-how"><span>How it’s calculated</span>{e.how}</p>}
                    {e.note && <p className="an-guide-note"><span>Good to know</span>{e.note}</p>}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
