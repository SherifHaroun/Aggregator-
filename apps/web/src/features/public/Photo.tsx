import { useState, type ImgHTMLAttributes } from 'react';

/**
 * A photograph that is decoration: silent to a screen reader, and simply
 * absent — never a broken-image glyph — while its file has yet to be put in
 * `public/images/`. The surface behind it shows through instead.
 */
export function Photo({ className, ...props }: Omit<ImgHTMLAttributes<HTMLImageElement>, 'alt'>) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return (
    <img
      alt=""
      draggable={false}
      decoding="async"
      loading="lazy"
      onError={() => setMissing(true)}
      className={className}
      {...props}
    />
  );
}
