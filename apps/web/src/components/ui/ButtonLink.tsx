import { Link, type LinkProps } from 'react-router-dom';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './Button';

/** A router link that looks like a button. Use instead of nesting a Link in a Button. */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  ...props
}: LinkProps & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}) {
  return (
    <Link
      className={buttonClasses({ variant, size, fullWidth, ...(className ? { className } : {}) })}
      {...props}
    />
  );
}
