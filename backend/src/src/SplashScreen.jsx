
import React, { useRef, useEffect, useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// --- CONFIG ---
const PARTICLE_COUNT = 100;
const GRAIN_COLORS = ["#E2C290", "#D1B07C", "#C2A06B"];
const BG_GRAIN_IMG = "/grain-bg.png"; // Place a blurred grain texture image in public/

// --- UTILS ---
function randomBetween(a, b) {
  return Math.random() * (b - a) + a;
}

// --- PARTICLE COMPONENT ---
const GrainParticle = memo(({ particle, progress }) => {
  // Parallax: slower for background, faster for foreground
  const parallax = particle.layer === "bg" ? 0.6 : 1.2;
  const y = (progress * 100 * parallax) % 110 - 10; // -10% to 100%
  const style = {
    position: "absolute",
    left: `${particle.x}vw`,
    top: `${y}vh`,
    width: particle.size,
    height: particle.size * 0.5,
    background: particle.color,
    borderRadius: "50% 60% 50% 60% / 60% 50% 60% 50%",
    filter: `blur(${particle.blur}px)`,
    opacity: particle.opacity,
    transform: `rotate(${particle.rotate}deg)`,
    boxShadow: `0 0 8px 0 ${particle.color}33`,
    zIndex: particle.layer === "bg" ? 1 : 3,
    pointerEvents: "none",
  };
  return <div style={style} />;
});

// --- MAIN SPLASH SCREEN ---
const SplashScreen = ({ onFinish }) => {
  const [show, setShow] = useState(true);
  const [logoIn, setLogoIn] = useState(false);
  const [glow, setGlow] = useState(0.5);
  const [progress, setProgress] = useState(0);

  // Generate particles once
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }).map((_, i) => ({
      id: i,
      x: randomBetween(2, 98),
      size: randomBetween(8, 22),
      speed: randomBetween(0.7, 1.5),
      rotate: randomBetween(-30, 30),
      opacity: randomBetween(0.5, 0.95),
      blur: randomBetween(0.2, 2.2),
      color: GRAIN_COLORS[Math.floor(Math.random() * GRAIN_COLORS.length)],
      layer: Math.random() > 0.5 ? "bg" : "fg",
      offset: Math.random(),
    }))
  ).current;

  // Animation loop
  useEffect(() => {
    let start = null;
    let frame;
    function animate(ts) {
      if (!start) start = ts;
      const elapsed = (ts - start) / 1000;
      setProgress(elapsed);
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Logo reveal and exit
  useEffect(() => {
    const logoTimer = setTimeout(() => {
      setLogoIn(true);
      setGlow(1.1);
    }, 1800);
    const exitTimer = setTimeout(() => {
      setShow(false);
      if (onFinish) onFinish();
    }, 4200);
    return () => {
      clearTimeout(logoTimer);
      clearTimeout(exitTimer);
    };
  }, [onFinish]);

  // --- RENDER ---
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 1, scale: 1 }}
          exit={{
            opacity: 0,
            scale: 0.97,
            transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] },
          }}
          style={{
            background: "linear-gradient(135deg, #0a0f0a 0%, #1a2e1a 100%)",
            overflow: "hidden",
          }}
        >
          {/* Blurred grain background */}
          <div
            className="absolute inset-0"
            style={{
              background: `url(${BG_GRAIN_IMG}) center/cover repeat`,
              filter: "blur(8px) brightness(0.7)",
              zIndex: 0,
              opacity: 0.7,
            }}
          />

          {/* Center light glow */}
          <motion.div
            className="absolute left-1/2 top-1/2"
            style={{
              width: 420,
              height: 420,
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              background: "radial-gradient(circle, #e2c29044 0%, #1a2e1a00 80%)",
              filter: `blur(32px)`,
              opacity: glow,
              zIndex: 2,
              pointerEvents: "none",
            }}
            animate={{ opacity: logoIn ? 1.1 : 0.5, scale: logoIn ? 1.1 : 1 }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
          />

          {/* Particles: background layer */}
          <div className="absolute inset-0" style={{ zIndex: 1 }}>
            {particles
              .filter((p) => p.layer === "bg")
              .map((p) => (
                <GrainParticle
                  key={p.id}
                  particle={p}
                  progress={((progress * p.speed + p.offset) % 1)}
                />
              ))}
          </div>

          {/* Particles: foreground layer */}
          <div className="absolute inset-0" style={{ zIndex: 3 }}>
            {particles
              .filter((p) => p.layer === "fg")
              .map((p) => (
                <GrainParticle
                  key={p.id}
                  particle={p}
                  progress={((progress * p.speed + p.offset) % 1)}
                />
              ))}
          </div>

          {/* Logo + glow */}
          <motion.div
            className="relative z-10 flex flex-col items-center"
            initial={{ opacity: 0, scale: 0.8, y: 30, filter: "blur(4px)" }}
            animate={
              logoIn
                ? {
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    filter: "blur(0px)",
                    transition: {
                      duration: 1.1,
                      ease: [0.4, 0, 0.2, 1],
                    },
                  }
                : {}
            }
          >
            {/* Logo glow */}
            <motion.div
              className="absolute left-1/2 top-1/2"
              style={{
                width: 180,
                height: 180,
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                background: "radial-gradient(circle, #e2c29099 0%, #1a2e1a00 80%)",
                filter: "blur(32px)",
                opacity: logoIn ? 1 : 0.5,
                zIndex: -1,
                pointerEvents: "none",
              }}
              animate={{ opacity: logoIn ? 1 : 0.5, scale: logoIn ? 1.1 : 1 }}
              transition={{ duration: 1.1, ease: "easeInOut" }}
            />
            {/* Replace with your SVG or logo image */}
            <svg width="120" height="120" viewBox="0 0 80 80" fill="none">
              <rect width="80" height="80" rx="16" fill="#1A2E1A" />
              <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dy=".35em"
                fontSize="32"
                fill="#fff"
                fontWeight="bold"
                fontFamily="sans-serif"
              >
                Carter++
              </text>
            </svg>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
