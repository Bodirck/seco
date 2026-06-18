import {
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { Link, type LinkProps } from "react-router-dom";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  /** Optional leading icon, expected to be an inline SVG (Heroicons outline). */
  leftIcon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps | "href"> & {
    href?: undefined;
    to?: undefined;
  };

type ButtonAsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps | "href"> & {
    href: string;
    to?: undefined;
  };

type ButtonAsRouterLink = CommonProps &
  Omit<LinkProps, keyof CommonProps | "to"> & {
    to: string;
    href?: undefined;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink | ButtonAsRouterLink;

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-display font-semibold cursor-pointer " +
  "transition duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70 " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-signal-500 text-onaccent hover:bg-signal-400 hover:shadow-signal",
  secondary:
    "border border-line text-fg hover:border-signal-400/60 hover:text-signal-300",
  ghost: "text-fg-muted hover:text-fg",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

/**
 * Primary interactive control. Renders a react-router Link when `to` is set (for
 * in-app navigation, no page reload), a plain anchor when `href` is set (external
 * links and file downloads), and a button otherwise. One accent only: `primary`
 * carries the signal fill, `secondary` is a hairline outline that warms to signal
 * on hover, `ghost` is text that brightens on hover.
 */
export function Button({
  variant = "primary",
  size = "md",
  leftIcon,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = cn(base, variants[variant], sizes[size], className);

  if ("to" in rest && rest.to !== undefined) {
    const { to, ...linkRest } = rest as ButtonAsRouterLink;
    return (
      <Link to={to} className={classes} {...linkRest}>
        {leftIcon}
        {children}
      </Link>
    );
  }

  if ("href" in rest && rest.href !== undefined) {
    const { href, ...anchorRest } = rest as ButtonAsLink;
    return (
      <a href={href} className={classes} {...anchorRest}>
        {leftIcon}
        {children}
      </a>
    );
  }

  const { type, ...buttonRest } = rest as ButtonAsButton;
  return (
    <button type={type ?? "button"} className={classes} {...buttonRest}>
      {leftIcon}
      {children}
    </button>
  );
}
