import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";

interface AnimatedSectionProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  delay?: number;
  direction?: "up" | "left" | "right" | "none";
}

const directionOffset = {
  up: { x: 0, y: 32 },
  left: { x: -32, y: 0 },
  right: { x: 32, y: 0 },
  none: { x: 0, y: 0 },
};

export default function AnimatedSection({
  children,
  className,
  id,
  delay = 0,
  direction = "up",
}: AnimatedSectionProps) {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.12,
    rootMargin: "-40px 0px",
  });

  const offset = directionOffset[direction];

  return (
    <motion.section
      ref={ref}
      id={id}
      className={className}
      initial={{ opacity: 0, x: offset.x, y: offset.y }}
      animate={inView ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x: offset.x, y: offset.y }}
      transition={{
        duration: 0.55,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.section>
  );
}

export function AnimatedDiv({
  children,
  className,
  delay = 0,
  direction = "up",
}: Omit<AnimatedSectionProps, "id">) {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
    rootMargin: "-20px 0px",
  });

  const offset = directionOffset[direction];

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, x: offset.x, y: offset.y }}
      animate={inView ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x: offset.x, y: offset.y }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
