import { useId, useLayoutEffect, useReducer, useRef } from 'react';
import { createOutcomeExpansion, outcomeExpansionReducer } from '../shared/outcomeExpansion.js';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { ExplorerGroupOutcomes, ExplorerOutcomeColumns } from './ExplorerBackgroundControls.jsx';
import './explorer-outcomes-panel.css';

const COPY = {
  en: { expand: 'Expand all', collapse: 'Collapse all' },
  zh: { expand: '全部展开', collapse: '全部收起' },
  es: { expand: 'Expandir todo', collapse: 'Contraer todo' },
};

export default function ExplorerOutcomesPanel({ title, groups, binning, policyId, lang = 'en', onHighlight }) {
  const t = COPY[lang] || COPY.en;
  const id = useId();
  const scrollport = useRef(null);
  const keys = groups.map(feature => feature.key);
  const [expansion, dispatchExpansion] = useReducer(outcomeExpansionReducer, { policyId, keys },
    initial => createOutcomeExpansion(initial.policyId, initial.keys));
  // Reset before children commit, while retaining DOM nodes for the transition.
  if (expansion.policyId !== policyId) dispatchExpansion({ type: 'policy', policyId, keys });
  const expanded = expansion.expanded;
  useLayoutEffect(() => {
    scrollport.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [policyId]);
  const allExpanded = keys.length > 0 && keys.every(key => expanded.includes(key));
  const ToggleIcon = allExpanded ? ChevronsDownUp : ChevronsUpDown;
  return <div className="explorer-outcomes-panel">
    <div className="outcomes-panel-heading">
      <h2 className="workspace-section-title font-bold leading-tight text-white">{title}</h2>
      <button type="button" className="outcomes-toggle-all" aria-controls={`${id}-groups`} disabled={!keys.length}
        onClick={() => {
          dispatchExpansion({ type: 'all', keys });
          scrollport.current?.scrollTo({ top: 0, behavior: 'instant' });
        }}>
        <ToggleIcon size={12} aria-hidden="true" /><span>{allExpanded ? t.collapse : t.expand}</span>
      </button>
    </div>
    <div ref={scrollport} className="outcomes-panel-scroll" tabIndex={0} role="region" aria-label={title}>
      <ExplorerOutcomeColumns lang={lang} />
      <div id={`${id}-groups`}>
        <ExplorerGroupOutcomes groups={groups} binning={binning} lang={lang} expandedKeys={expanded}
          onHighlight={onHighlight} highlightContextKey={policyId}
          onToggle={key => dispatchExpansion({ type: 'toggle', key })} />
      </div>
    </div>
  </div>;
}
