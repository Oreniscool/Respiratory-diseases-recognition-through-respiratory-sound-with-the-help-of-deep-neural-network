import { useEffect } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
} from "framer-motion";

export default function AmbientEffects() {
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(-600);
  const pointerY = useMotionValue(-600);
  const smoothX = useSpring(pointerX, { stiffness: 90, damping: 24, mass: 0.5 });
  const smoothY = useSpring(pointerY, { stiffness: 90, damping: 24, mass: 0.5 });
  const pointerGlow = useMotionTemplate`radial-gradient(540px circle at ${smoothX}px ${smoothY}px, rgba(34, 211, 238, 0.095), rgba(99, 102, 241, 0.035) 40%, transparent 72%)`;
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 150,
    damping: 28,
    restDelta: 0.001,
  });

  useEffect(() => {
    if (reduceMotion) return;
    const handlePointer = (event: PointerEvent) => {
      pointerX.set(event.clientX);
      pointerY.set(event.clientY);
    };
    window.addEventListener("pointermove", handlePointer, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointer);
  }, [pointerX, pointerY, reduceMotion]);

  const ambientAnimation = reduceMotion
    ? undefined
    : {
        x: [0, 70, -35, 0],
        y: [0, -45, 50, 0],
        scale: [1, 1.18, 0.94, 1],
        rotate: [0, 18, -12, 0],
      };

  return (
    <div className="ambient-stage" aria-hidden="true">
      <motion.div
        className="ambient-pointer-glow"
        style={{ background: pointerGlow }}
      />
      <motion.div
        className="ambient-orb ambient-orb-cyan"
        animate={ambientAnimation}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="ambient-orb ambient-orb-indigo"
        animate={
          reduceMotion
            ? undefined
            : {
                x: [0, -80, 30, 0],
                y: [0, 55, -35, 0],
                scale: [1, 0.92, 1.2, 1],
                rotate: [0, -20, 16, 0],
              }
        }
        transition={{ duration: 29, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="ambient-orb ambient-orb-teal"
        animate={
          reduceMotion
            ? undefined
            : {
                x: [0, 45, -60, 0],
                y: [0, 65, 20, 0],
                scale: [0.9, 1.12, 1, 0.9],
              }
        }
        transition={{ duration: 21, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="ambient-grid" />
      <div className="ambient-vignette" />
      <motion.div className="scroll-progress" style={{ scaleX: progress }} />
    </div>
  );
}
