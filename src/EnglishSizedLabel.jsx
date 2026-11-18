// Keep a control at its English size while exposing only its current label to assistive technology.
export default function EnglishSizedLabel({ english, children, icon }) {
  return <span className="english-sized-label">
    <span className="english-label-measure" aria-hidden="true" lang="en" translate="no">{icon}{english}</span>
    <span className="english-label-current">{icon}{children}</span>
  </span>;
}
