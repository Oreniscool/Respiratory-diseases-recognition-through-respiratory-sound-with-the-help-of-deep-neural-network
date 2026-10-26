import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 18, children, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const ArrowRight = (p: IconProps) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
export const Upload = (p: IconProps) => <Icon {...p}><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></Icon>;
export const Mic = (p: IconProps) => <Icon {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></Icon>;
export const Play = (p: IconProps) => <Icon {...p}><path d="M7 4l13 8-13 8z" /></Icon>;
export const Pause = (p: IconProps) => <Icon {...p}><path d="M8 4v16M16 4v16" /></Icon>;
export const Alert = (p: IconProps) => <Icon {...p}><path d="M12 3l10 18H2zM12 10v5M12 18h.01" /></Icon>;
export const Check = (p: IconProps) => <Icon {...p}><path d="M5 12l5 5 9-10" /></Icon>;
export const Wave = (p: IconProps) => <Icon {...p}><path d="M2 12h3l2-6 3 12 3-9 2 5 2-2h5" /></Icon>;
