import React, { useRef, useEffect } from 'react';

export const Background = ({ darkMode }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];

    // UPGRADE: More particles for a denser network
    const particleCount = window.innerWidth < 768 ? 60 : 130; // 60 on mobile, 130 on desktop
    const connectionDistance = 120; 
    const moveSpeed = 0.6; // Slightly faster for "pronounced" effect

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * moveSpeed,
          vy: (Math.random() - 0.5) * moveSpeed,
          size: Math.random() * 2.5 + 1.5, // Larger nodes
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // UPGRADE: Stronger Colors & Glow
      // Light Mode: Dark Slate Blue (Visible) | Dark Mode: Bright Blue/White (Glowing)
      const nodeColor = darkMode ? 'rgba(148, 163, 184, 0.9)' : 'rgba(71, 85, 105, 0.8)'; 
      const lineColorBase = darkMode ? '148, 163, 184' : '71, 85, 105'; // RGB values for template string

      // Add Glow Effect
      ctx.shadowBlur = darkMode ? 15 : 0; // Only glow in dark mode to keep light mode crisp
      ctx.shadowColor = darkMode ? 'rgba(59, 130, 246, 0.5)' : 'transparent';

      particles.forEach((p, index) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = nodeColor;
        ctx.fill();

        // Draw Connections
        // Reset shadow for lines (performance)
        ctx.shadowBlur = 0; 
        
        for (let j = index + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            const opacity = 1 - distance / connectionDistance;
            ctx.beginPath();
            // Stronger line opacity (up to 0.4 instead of 0.2)
            ctx.strokeStyle = `rgba(${lineColorBase}, ${opacity * 0.4})`;
            ctx.lineWidth = 1.5; // Thicker lines
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
        // Restore shadow for next node
        ctx.shadowBlur = darkMode ? 15 : 0;
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    resizeCanvas();
    draw();

    window.addEventListener('resize', resizeCanvas);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [darkMode]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none transition-opacity duration-500"
    />
  );
};