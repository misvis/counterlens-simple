import { EXPLORER_FEATURES, getExplorerOptions } from '../shared/featureExplorer.js';
import './explorer-policy.css';

const COPY = {
  en: { points: 'Points', feature: 'Feature', cutoff: 'Cutoff', other: 'Missing / unlisted', unused: 'Not used', range: 'Numeric points vary linearly between endpoints and stay capped outside them.', simulated: 'Illustrative coefficients for the synthetic demo.' },
  zh: { points: '得分', feature: '特征', cutoff: '录取阈值', other: '缺失／未列出类别', unused: '不参与计分', range: '数值得分在端点之间线性变化，超出端点后保持边界值。', simulated: '系数为合成数据演示而设。' },
  es: { points: 'Puntos', feature: 'Variable', cutoff: 'Corte', other: 'Ausente / no listado', unused: 'No se usa', range: 'Los puntos numéricos varían linealmente entre los extremos y se limitan fuera de ellos.', simulated: 'Coeficientes ilustrativos para los datos sintéticos.' },
};
const label = (names, lang) => names?.[lang] || names?.en || '';
const points = value => value > 0 ? `+${value}` : String(value);
const money = value => `$${value.toLocaleString('en-US')}`;

export default function ExplorerPolicyDetails({ policy, lang = 'en' }) {
  const t = COPY[lang] || COPY.en;
  return <div className="explorer-policy-details" data-explorer-policy-rules>
    <p>{t.simulated}</p>
    <table>
      <thead><tr><th>{t.feature}</th><th>{t.points}</th></tr></thead>
      <tbody>
        <tr><th>GPA</th><td>2.4 → 0 · 4 → {points(policy.weights.gpa)}</td></tr>
        <tr><th>SAT Percentile</th><td>0 → 0 · 100 → {points(policy.weights.sat)}</td></tr>
        {EXPLORER_FEATURES.map(feature => {
          const rule = policy.backgroundRules[feature.key];
          const unused = Object.values(rule.points).every(value => value === 0);
          return <tr key={feature.key}><th>{label(feature.label, lang)}</th><td>
            {unused ? t.unused : rule.type === 'linear'
              ? `${money(rule.domain[0])} → ${points(rule.points[0])} · ${money(rule.domain[1])} → ${points(rule.points[1])}`
              : getExplorerOptions(feature.key, [], []).map(option => <span className="explorer-rule-value" key={option.value}>{label(option.label, lang)} <b>{points(rule.points[option.value] ?? 0)}</b></span>)}
          </td></tr>;
        })}
        <tr><th>{t.other}</th><td>0</td></tr>
        <tr><th>{t.cutoff}</th><td>{policy.threshold}</td></tr>
      </tbody>
    </table>
    <p className="explorer-rule-note">{t.range}</p>
  </div>;
}
