export default function BrandMark({ size, className }) {
  return <img src={`${import.meta.env.BASE_URL}logo.svg?v=tripod`}
    width={size} height={size} className={className} alt="" />;
}
