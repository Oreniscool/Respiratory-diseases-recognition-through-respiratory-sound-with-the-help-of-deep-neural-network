import type { AriaRole, CSSProperties, KeyboardEvent, ReactNode } from "react";
import {
  motion,
  type MotionStyle,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  delay?: number;
  role?: AriaRole;
  tabIndex?: number;
  onClick?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
}

export default function TiltCard({
  children,
  className = "",
  style,
  delay = 0,
  role,
  tabIndex,
  onClick,
  onKeyDown,
}: TiltCardProps) {
  const reduceMotion = useReducedMotion();
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const glowX = useMotionValue(50);
  const glowY = useMotionValue(50);
  const smoothRotateX = useSpring(rotateX, { stiffness: 180, damping: 20 });
  const smoothRotateY = useSpring(rotateY, { stiffness: 180, damping: 20 });
  const glow = useMotionTemplate`radial-gradient(280px circle at ${glowX}% ${glowY}%, rgba(103, 232, 249, 0.15), transparent 68%)`;

  const reset = () => {
    rotateX.set(0);
    rotateY.set(0);
    glowX.set(50);
    glowY.set(50);
  };

  return (
    <motion.div
      className={`tilt-card ${className}`}
      initial={{ opacity: 0, y: 28, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduceMotion ? undefined : { y: -7, scale: 1.012 }}
      onPointerMove={(event) => {
        if (reduceMotion) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width;
        const y = (event.clientY - bounds.top) / bounds.height;
        rotateY.set((x - 0.5) * 8);
        rotateX.set((0.5 - y) * 8);
        glowX.set(x * 100);
        glowY.set(y * 100);
      }}
      onPointerLeave={reset}
      onBlur={reset}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role={role}
      tabIndex={tabIndex}
      style={{
        ...style,
        rotateX: smoothRotateX,
        rotateY: smoothRotateY,
        transformPerspective: 950,
        transformStyle: "preserve-3d",
      } as MotionStyle}
    >
      <motion.div className="tilt-card-glow" style={{ background: glow }} />
      <div className="tilt-card-content">{children}</div>
    </motion.div>
  );
}
