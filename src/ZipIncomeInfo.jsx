import { CircleAlert } from 'lucide-react';
import { ExplorerDropdown } from './ExplorerDropdown.jsx';
import './zip-income-info.css';

const SOURCE = 'https://hcup-us.ahrq.gov/db/vars/zipinc_qrtl/nisnote.jsp';
const COPY = {
  en: {
    title: 'About ZIP-area income',
    definition: 'Median household income in the student’s home ZIP code. An individual household’s income may differ.',
    source: 'The default groups use AHRQ’s 2014 HCUP national quartiles for ZIP-area income.',
    merged: 'This view combines the two middle quartiles.',
    quantile: 'This view groups students by income quantiles in the current cohort.',
    custom: 'This view uses the cut points entered in the visualizer.',
    scoring: 'The policy uses the dollar amount to calculate points.',
    link: 'View the 2014 cut points in the HCUP table',
  },
  zh: {
    title: '关于 ZIP 地区收入',
    definition: '学生居住邮区的住户收入中位数。学生自己家的收入可能高于或低于这个数。',
    source: '默认分组采用美国医疗研究与质量局（AHRQ）HCUP 项目公布的 2014 年全国邮区收入四分位界线。',
    merged: '当前视图将中间两个四分位组合并为一组。',
    quantile: '当前视图根据这批学生的地区收入分位数分组。',
    custom: '当前视图使用在可视化面板中输入的分界值。',
    scoring: '策略按具体的收入金额计算分数。',
    link: '查看 HCUP 表中的 2014 年分界值',
  },
  es: {
    title: 'Acerca de los ingresos de la zona ZIP',
    definition: 'Mediana de los ingresos de los hogares del código postal donde vive el estudiante. Los ingresos de su propio hogar pueden ser distintos.',
    source: 'Los grupos predeterminados usan los cuartiles nacionales de ingresos por código postal publicados por el programa HCUP de la AHRQ para 2014.',
    merged: 'Esta vista combina los dos cuartiles centrales.',
    quantile: 'Esta vista agrupa a los estudiantes por cuantiles de ingresos de la cohorte actual.',
    custom: 'Esta vista usa los límites introducidos en el visualizador.',
    scoring: 'La política usa el importe en dólares para calcular los puntos.',
    link: 'Ver los límites de 2014 en la tabla del HCUP',
  },
};

export default function ZipIncomeInfo({ lang, binning, scoring = false }) {
  const t = COPY[lang] || COPY.en;
  let note;
  if (scoring) note = t.scoring;
  else if (binning?.method === 'hcup2014' && binning.count === 3) note = t.merged;
  else if (binning?.method === 'quantile') note = t.quantile;
  else if (binning?.method === 'custom') note = t.custom;

  return <ExplorerDropdown className="zip-income-help" accessibleLabel={t.title} icon={<CircleAlert size={15} aria-hidden="true" />}>
    <strong>{t.title}</strong>
    <p>{t.definition}</p>
    <p>{t.source} {note}</p>
    <a href={SOURCE} target="_blank" rel="noopener noreferrer">{t.link}</a>
  </ExplorerDropdown>;
}
