import { useId, useRef, useState } from 'react';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { ExplorerGroupOutcomes, ExplorerOutcomeColumns } from './ExplorerBackgroundControls.jsx';
import './explorer-outcomes-panel.css';

const COPY = {
  en: { expand: 'Expand all', collapse: 'Collapse all' },
  zh: { expand: '全部展开', collapse: '全部收起' },
  es: { expand: 'Expandir todo', collapse: 'Contraer todo' },
};

export default function ExplorerOutcomesPanel({ title, groups, binning, policyId, lang = 'en' }) {
  const t = COPY[lang] || COPY.en;
  const id = useId();
  const scrollport = useRef(null);
  const [expandedByPolicy, setExpandedByPolicy] = useState({});
  const keys = groups.map(feature => feature.key);
  const defaults = policyId === 'academic' ? keys : ['residency', 'zipIncome'];
  const expanded = expandedByPolicy[policyId] ?? defaults;
  const allExpanded = keys.length > 0 && keys.every(key => expanded.includes(key));
  const ToggleIcon = allExpanded ? ChevronsDownUp : ChevronsUpDown;
  return <div className="explorer-outcomes-panel">
    <div className="outcomes-panel-heading">
      <h2 className="workspace-section-title font-bold leading-tight text-white">{title}</h2>
      <button type="button" className="outcomes-toggle-all" aria-controls={`${id}-groups`} disabled={!keys.length}
        onClick={() => {
          setExpandedByPolicy(current => ({ ...current, [policyId]: allExpanded ? [] : keys }));
          scrollport.current?.scrollTo({ top: 0, behavior: 'instant' });
        }}>
        <ToggleIcon size={12} aria-hidden="true" /><span>{allExpanded ? t.collapse : t.expand}</span>
      </button>
    </div>
    <div ref={scrollport} className="outcomes-panel-scroll" tabIndex={0} role="region" aria-label={title}>
      <ExplorerOutcomeColumns lang={lang} />
      <div id={`${id}-groups`}>
        <ExplorerGroupOutcomes groups={groups} binning={binning} lang={lang} expandedKeys={expanded}
          onToggle={key => setExpandedByPolicy(current => ({ ...current, [policyId]: expanded.includes(key) ? expanded.filter(item => item !== key) : [...expanded, key] }))} />
      </div>
    </div>
  </div>;
}
