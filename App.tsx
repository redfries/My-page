import React, { useEffect, useRef, useState } from 'react';
import {
  Github,
  Linkedin,
  Mail,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  User,
  MessageSquare,
} from 'lucide-react';
import TubesInfinity, { heroWarp, type HeroStatus } from './TubesInfinity';
import Starfield from './Starfield';

// --- Types ---
interface Project {
  id: string;
  title: string;
  category: string;
  tagline: string;
  description: string;
  tags: string[];
  status: string;
  accentColor: string;
  links: {
    live?: string;
    github: string;
  };
}

// --- Constants ---
const PROJECTS: Project[] = [
  {
    id: "reading-with-ai",
    title: "Reading with AI",
    category: "Research / NLP",
    tagline: "Read what matters.",
    description: "A research reader that learns what you care about and ranks every passage in a paper against it. The signal rises; the noise recedes.",
    tags: ["Qwen embeddings", "Semantic ranking", "FastAPI"],
    status: "Live app",
    accentColor: "#7dd3fc",
    links: {
      live: "https://infinitys.me/pre",
      github: "https://github.com/redfries/personalized-reading-experience"
    }
  },
  {
    id: "arabic-cheque-ocr",
    title: "Arabic Cheque OCR",
    category: "Computer Vision",
    tagline: "From pixels to a verified amount.",
    description: "An end-to-end pipeline for Arabic cheques. It locates each field, reads the handwriting, and cross-checks the legal amount against the figures.",
    tags: ["Cascade R-CNN", "TrOCR", "Qwen3.5 LoRA"],
    status: "End-to-end system",
    accentColor: "#86efac",
    links: {
      live: "https://infinitys.me/ocr",
      github: "https://github.com/redfries/arabic-cheque-ocr"
    }
  },
  {
    id: "career-ops",
    title: "Career-Ops",
    category: "Agent Systems",
    tagline: "A pipeline, not a conversation.",
    description: "Job search automation with a state machine underneath. It ingests a role, maps the fit, tailors a two-page LaTeX resume, submits through the ATS, and leaves a receipt at every step.",
    tags: ["Playwright", "SQLite", "Tectonic"],
    status: "Open source",
    accentColor: "#fdba74",
    links: {
      github: "https://github.com/redfries/career-ops-automation"
    }
  },
  {
    id: "paper2tex",
    title: "paper2tex",
    category: "Developer Tooling",
    tagline: "Your words. Your equations. Intact.",
    description: "An agent skill that turns Word manuscripts into conference-ready LaTeX. Math comes straight from OMML, figures are straightened and scaled, and the compiler repairs its own missing packages.",
    tags: ["Python", "Pandoc", "OMML → LaTeX"],
    status: "Agent skill",
    accentColor: "#c4b5fd",
    links: {
      github: "https://github.com/redfries/paper2tex"
    }
  }
];

// --- Components ---


/**
 * ParticleGrid Component
 * Implements a strict, engineered grid that distorts with mouse movement (CRED style)
 */
const ParticleGrid: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;

    // Configuration
    const spacing = 45; // Grid spacing
    const radius = 1.2; // Dot radius
    const mouseRadius = 200; // Influence radius
    const returnSpeed = 0.08; // Snap back speed
    const pushFactor = 0.5; // How much the grid distorts

    let mouseX = -1000;
    let mouseY = -1000;

    interface Point {
      x: number;
      y: number;
      originX: number;
      originY: number;
      vx: number;
      vy: number;
    }

    let points: Point[] = [];

    const init = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      // Back the canvas with real device pixels. At a fixed ratio of 1 the
      // compositor was upscaling the whole grid — 3x on a typical phone — which
      // left the dots soft and blocky. The transform keeps every coordinate
      // below (and the hero warp, which arrives in viewport pixels) in CSS px.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      points = [];

      const cols = Math.ceil(width / spacing) + 2;
      const rows = Math.ceil(height / spacing) + 2;

      // Start slightly off-screen to cover edges
      for (let i = -1; i < cols; i++) {
        for (let j = -1; j < rows; j++) {
          const x = i * spacing;
          const y = j * spacing;
          
          points.push({
            x,
            y,
            originX: x,
            originY: y,
            vx: 0,
            vy: 0
          });
        }
      }
    };

    const animate = () => {
      // Clear with a very slight fade for trail effect if desired, but for minimal look, full clear is better
      ctx.clearRect(0, 0, width, height);
      
      points.forEach(point => {
        const dx = mouseX - point.x;
        const dy = mouseY - point.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < mouseRadius) {
            const angle = Math.atan2(dy, dx);
            const force = (mouseRadius - distance) / mouseRadius;
            const moveX = Math.cos(angle) * force * spacing * pushFactor;
            const moveY = Math.sin(angle) * force * spacing * pushFactor;
            
            // Push away from mouse
            point.vx -= moveX * 0.1;
            point.vy -= moveY * 0.1;
        }

        // The hero's 3D comet warps the grid as it traces the infinity.
        // heroWarp.strength stays 0 unless that scene is running, so this is
        // inert when the 3D hero is absent.
        if (heroWarp.strength > 0) {
          const hdx = heroWarp.x - point.x;
          const hdy = heroWarp.y - point.y;
          const hDist = Math.sqrt(hdx * hdx + hdy * hdy);
          const hRadius = 280;
          if (hDist < hRadius) {
            const angle = Math.atan2(hdy, hdx);
            const force = ((hRadius - hDist) / hRadius) * heroWarp.strength;
            point.vx -= Math.cos(angle) * force * spacing * pushFactor * 0.16;
            point.vy -= Math.sin(angle) * force * spacing * pushFactor * 0.16;
          }
        }

        // Return to origin (spring physics)
        const homeDx = point.originX - point.x;
        const homeDy = point.originY - point.y;
        
        point.vx += homeDx * returnSpeed;
        point.vy += homeDy * returnSpeed;

        // Friction
        point.vx *= 0.80;
        point.vy *= 0.80;

        point.x += point.vx;
        point.y += point.vy;

        // Draw point
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        // CRED style: Subtle grey dots
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.05, 0.15 - (distance/1000))})`; 
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const handleResize = () => {
      init();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);

    init();
    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 mix-blend-screen"
    />
  );
};

const Header: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${isScrolled ? 'bg-black/90 backdrop-blur-md py-4 border-b border-white/5' : 'bg-transparent py-8'}`}>
      <div className="container mx-auto px-6 md:px-12 flex justify-between items-center">
        {/* Brand Name */}
        <div className="text-[0.7rem] sm:text-base md:text-xl font-normal tracking-[0.15em] sm:tracking-[0.2em] text-white flex items-center gap-2 font-['Syncopate'] cursor-default select-none whitespace-nowrap">
          SHABAAZ HUSSAIN
        </div>
        
        {/* Navigation - Visible on Mobile as Icons, Desktop as Text */}
        <nav className="flex gap-6 md:gap-12 text-neutral-400 items-center">
          <a href="#projects" className="hover:text-white transition-colors duration-300 flex items-center">
            <span className="md:hidden"><Briefcase size={20} /></span>
            <span className="hidden md:block text-xs font-bold tracking-[0.2em] uppercase">Work</span>
          </a>
          <a href="#about" className="hover:text-white transition-colors duration-300 flex items-center">
            <span className="md:hidden"><User size={20} /></span>
            <span className="hidden md:block text-xs font-bold tracking-[0.2em] uppercase">Profile</span>
          </a>
          <a href="#contact" className="hover:text-white transition-colors duration-300 flex items-center">
            <span className="md:hidden"><MessageSquare size={20} /></span>
            <span className="hidden md:block text-xs font-bold tracking-[0.2em] uppercase">Contact</span>
          </a>
        </nav>
      </div>
    </header>
  );
};

const ProjectFrame: React.FC<{ accentColor: string; children: React.ReactNode }> = ({ accentColor, children }) => (
  <div className="relative h-[228px] shrink-0 overflow-hidden border-b border-white/[0.06] bg-[#050505] sm:h-[258px]">
    <div className="showcase-grid absolute inset-0 opacity-60" />
    <div
      className="absolute inset-0"
      style={{ background: `radial-gradient(90% 80% at 50% 115%, ${accentColor}14, transparent 65%)` }}
    />
    {children}
  </div>
);

const ReadingVisual: React.FC = () => (
  <ProjectFrame accentColor="#7dd3fc">
    <div className="absolute inset-0 flex items-center justify-center px-7 pb-6 pt-7">
      <div className="relative w-full max-w-[360px] rounded-[3px] border border-white/[0.09] bg-[#0b0c0f]/95 px-6 py-5 shadow-[0_24px_50px_-20px_rgba(0,0,0,0.9)] transition-transform duration-700 group-hover:-translate-y-1.5">
        <div className="flex items-center justify-between font-mono text-[8px] uppercase tracking-[0.2em] text-neutral-600">
          <span>ARXIV / 2603.0142</span>
          <span>12 / 28</span>
        </div>
        <div className="mt-5 h-[7px] w-[82%] rounded-full bg-white/20" />
        <div className="mt-2 h-[5px] w-[54%] rounded-full bg-white/10" />
        <div className="mt-5 space-y-[7px]">
          <div className="h-[3px] w-full rounded-full bg-white/[0.07]" />
          <div className="h-[3px] w-[91%] rounded-full bg-white/[0.07]" />
          <div className="h-[3px] w-[76%] rounded-full bg-white/[0.07]" />
        </div>
        <div className="relative mt-4 overflow-hidden rounded-r-sm border-l-2 bg-sky-300/[0.06] py-2.5 pl-3 pr-2" style={{ borderColor: '#7dd3fc' }}>
          <p className="font-['Instrument_Serif'] text-[12px] italic leading-snug text-sky-100/90">The useful signal is often one paragraph deep.</p>
          <div className="mt-2 h-[3px] w-[88%] rounded-full bg-sky-200/20" />
          <div className="mt-1.5 h-[3px] w-[64%] rounded-full bg-sky-200/10" />
        </div>
        <div className="mt-4 space-y-[7px]">
          <div className="h-[3px] w-[84%] rounded-full bg-white/[0.06]" />
          <div className="h-[3px] w-[69%] rounded-full bg-white/[0.06]" />
        </div>
      </div>
    </div>
  </ProjectFrame>
);

const OcrVisual: React.FC = () => (
  <ProjectFrame accentColor="#86efac">
    <div className="absolute inset-0 flex items-center justify-center px-6 pb-6 pt-7">
      <div className="relative w-full max-w-[350px] -rotate-1 rounded-[3px] bg-[#e9e4d8] px-6 py-5 text-[#24211b] shadow-[0_24px_55px_-18px_rgba(0,0,0,0.85)] transition-transform duration-700 group-hover:rotate-0">
        <div className="flex items-start justify-between border-b border-black/15 pb-2 font-mono text-[7px] uppercase tracking-[0.22em] text-black/45">
          <span>Al Rajhi Bank</span>
          <span>Cheque / 048291</span>
        </div>
        <div className="mt-3 flex items-start justify-between gap-5">
          <div className="relative border border-emerald-600/65 px-1.5 py-1">
            <span className="absolute -top-[9px] left-0 bg-emerald-700 px-1 font-mono text-[6px] leading-[11px] text-white">PAYEE</span>
            <p className="text-[12px] font-semibold">Advanced Technology Co.</p>
          </div>
          <div className="relative border border-emerald-600/65 px-1.5 py-1 text-right" dir="rtl">
            <span className="absolute -top-[9px] left-0 bg-emerald-700 px-1 font-mono text-[6px] leading-[11px] text-white">LEGAL AMOUNT</span>
            <p className="text-[11px]">خمسة وأربعون ألف ريال</p>
          </div>
        </div>
        <div className="mt-5 flex items-end justify-between gap-4">
          <div className="relative border border-emerald-600/65 px-1.5 py-1">
            <span className="absolute -top-[9px] left-0 bg-emerald-700 px-1 font-mono text-[6px] leading-[11px] text-white">AMOUNT</span>
            <p className="font-mono text-[19px] font-semibold tracking-tight">SAR 45,000.00</p>
          </div>
          <svg viewBox="0 0 72 26" className="mb-1 h-6 w-16 text-black/40" fill="none" aria-hidden="true">
            <path d="M2 17c8-10 13 4 21-4 7-7 9 8 17 1 6-6 9 5 14-2 4-5 7 2 16 1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
          </svg>
        </div>
        <div className="absolute inset-x-0 top-0 h-px bg-emerald-400/50 opacity-0 shadow-[0_0_10px_rgba(52,211,153,0.7)] transition-all duration-[1200ms] group-hover:top-full group-hover:opacity-100" />
      </div>
    </div>
  </ProjectFrame>
);

const CareerOpsVisual: React.FC = () => (
  <ProjectFrame accentColor="#fdba74">
    <div className="absolute inset-0 flex items-center px-8">
      <div className="w-full max-w-[330px]">
        <div className="mb-5 flex items-center justify-between font-mono text-[8px] uppercase tracking-[0.22em] text-neutral-600">
          <span>Stateful pipeline</span>
          <span>04 stages</span>
        </div>
        <div className="relative space-y-3 pl-6">
          <div className="absolute bottom-1 left-[2px] top-1 w-px bg-white/10" />
          <div className="absolute bottom-1 left-[2px] top-1 w-px origin-top scale-y-0 bg-amber-300/70 transition-transform duration-1000 group-hover:scale-y-100" />
          {[
            ['01', 'Ingest role', 'parsed'],
            ['02', 'Tailor resume', 'tailored'],
            ['03', 'Verify fields', 'verified'],
            ['04', 'Submit + outreach', 'receipt'],
          ].map(([number, label, state], i) => (
            <div key={number} className="relative flex items-center justify-between">
              <span className={`absolute -left-6 h-[5px] w-[5px] rounded-full border ${i === 3 ? 'border-amber-300 bg-amber-300/30' : 'border-white/25 bg-[#090807]'}`} />
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[8px] text-neutral-600">{number}</span>
                <span className="text-[11px] text-neutral-300">{label}</span>
              </div>
              <span className="font-mono text-[8px] text-neutral-600">{state}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between rounded-md border border-white/[0.06] bg-white/[0.015] px-3 py-2 font-mono text-[8px] text-neutral-500">
          <span>resume.pdf</span>
          <span className="text-amber-200/80">2 pages · receipt saved</span>
        </div>
      </div>
    </div>
  </ProjectFrame>
);

const Paper2TexVisual: React.FC = () => (
  <ProjectFrame accentColor="#c4b5fd">
    <div className="absolute inset-0 flex items-center justify-center gap-3 px-6 pb-5 pt-6">
      <div className="w-[42%] -rotate-1 rounded-[2px] bg-[#e9e6dd] p-4 text-[#28251f] shadow-[0_18px_40px_-16px_rgba(0,0,0,0.8)] transition-transform duration-700 group-hover:-translate-x-1 group-hover:rotate-0">
        <div className="font-mono text-[6px] uppercase tracking-[0.2em] text-black/40">Manuscript.docx</div>
        <div className="mt-3 font-['Instrument_Serif'] text-[13px] leading-tight">Attention is all you need</div>
        <div className="mt-2 space-y-1">
          <div className="h-[2px] w-full bg-black/15" />
          <div className="h-[2px] w-[88%] bg-black/10" />
          <div className="h-[2px] w-[72%] bg-black/10" />
        </div>
        <div className="mt-3 rounded-sm bg-black/[0.04] px-2 py-1 text-center font-['Instrument_Serif'] text-[12px] italic">E = mc²</div>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-1 text-violet-300/60">
        <span className="font-mono text-[6px] uppercase tracking-[0.18em]">OMML</span>
        <ArrowRight size={12} className="transition-transform duration-700 group-hover:translate-x-1" />
      </div>
      <div className="w-[48%] rounded-[2px] border border-violet-300/20 bg-[#09060d] p-3 font-mono text-[8px] leading-relaxed text-neutral-400 shadow-[0_18px_45px_-16px_rgba(0,0,0,0.9)] transition-transform duration-700 group-hover:translate-x-1">
        <div className="text-violet-300/80">{"\\documentclass{IEEEtran}"}</div>
        <div className="text-neutral-600">{"\\begin{document}"}</div>
        <div className="text-neutral-300 truncate">{"\\title{Attention...}"}</div>
        <div className="text-violet-200">{"$E = mc^2$"}</div>
        <div className="text-neutral-600">{"\\end{document}"}</div>
      </div>
    </div>
  </ProjectFrame>
);

const ProjectVisual: React.FC<{ projectId: string }> = ({ projectId }) => {
  switch (projectId) {
    case 'reading-with-ai':
      return <ReadingVisual />;
    case 'arabic-cheque-ocr':
      return <OcrVisual />;
    case 'career-ops':
      return <CareerOpsVisual />;
    case 'paper2tex':
      return <Paper2TexVisual />;
    default:
      return null;
  }
};

const ProjectCard: React.FC<{ project: Project; index: number }> = ({ project, index }) => {
  const href = project.links.live ?? project.links.github;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open ${project.title}`}
      className="showcase-card group relative flex h-full flex-col overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#070707]/85 backdrop-blur-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/40"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100"
        style={{ background: `radial-gradient(70% 48% at 18% 0%, ${project.accentColor}14, transparent 72%)` }}
      />
      <ProjectVisual projectId={project.id} />

      <div className="relative flex flex-1 flex-col p-6 md:p-7">
        <div className="flex items-center justify-between gap-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-500">
            {String(index + 1).padStart(2, '0')} / {project.category}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-neutral-500">{project.status}</span>
        </div>

        <h3 className="mt-5 font-['Syncopate'] text-[clamp(1.3rem,2.2vw,1.8rem)] font-bold leading-[1.15] tracking-tight text-white">
          {project.title}
        </h3>
        <p className="mt-3 max-w-[54ch] text-sm leading-relaxed text-neutral-400">{project.description}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          {project.tags.map(tag => (
            <span
              key={tag}
              className="rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 font-mono text-[10px] tracking-wide text-neutral-500 transition-colors duration-500 group-hover:border-white/[0.14] group-hover:text-neutral-400"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between gap-5 pt-7">
          <p className="font-['Instrument_Serif'] text-[19px] italic leading-snug text-neutral-500 transition-colors duration-500 group-hover:text-neutral-300">
            {project.tagline}
          </p>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-neutral-400 transition-all duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:border-white/25 group-hover:text-white">
            <ArrowUpRight size={15} />
          </span>
        </div>
      </div>
    </a>
  );
};

const InfinitySymbol: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    viewBox="0 0 200 100" 
    className={`w-full max-w-[420px] h-auto text-white ${className}`}
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M50 50C25 50 10 30 10 30C10 30 50 0 100 50C150 100 190 70 190 70C190 70 175 50 150 50C125 50 100 80 100 80C100 80 60 100 50 50Z"
      stroke="none"
    />
    {/* Smoother Bezier Infinity */}
    <path 
      d="M100 50 C 100 50, 150 100, 175 75 C 200 50, 150 0, 100 50 C 50 100, 0 50, 25 25 C 50 0, 100 50, 100 50"
      stroke="currentColor" 
      strokeWidth="2"
      strokeLinecap="round"
      className="infinity-path opacity-90 drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]"
    />
  </svg>
);

/**
 * The hero is one centred column: heading, a spacer that reserves exactly the
 * box the figure can occupy, then the rest of the text. The 3D scene publishes
 * that box as --infinity-h (its static extents plus the reach of the idle
 * drift) and centres its camera on the spacer, so the figure and the text agree
 * on where the middle is by construction.
 *
 * Both text blocks used to be pinned to the section's own centre line with a
 * fixed clearance instead. That assumed three things that were not true: that
 * the reserved height covered the drift (it was the static height, so the loop
 * swung ~13px past it on a phone and ~50px on a desktop, into an 8px gap), that
 * the canvas and the section share a centre line (the canvas is viewport-sized
 * and the section is 100svh, which differ by the mobile URL bar), and that the
 * measurement arrives before first paint (it came from inside the Three.js
 * import, so the text jumped when it landed).
 */
const MainHero: React.FC<{
  status: HeroStatus;
  figureRef: React.RefObject<HTMLDivElement | null>;
}> = ({ status, figureRef }) => {
  return (
    <section
      className="relative min-h-screen z-10 overflow-hidden select-none cursor-default"
      style={{ minHeight: '100svh' }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center pointer-events-none">
        <h2
          className="text-[clamp(0.9rem,2.1vw,1.65rem)] font-normal tracking-[0.5em] text-neutral-200 uppercase animate-fade-in-up reveal-1 mb-[clamp(8px,1.2vh,18px)] font-['Syncopate'] drop-shadow-[0_0_16px_rgba(125,211,252,0.18)]"
          style={{ textIndent: '0.5em' }}
        >
          To
        </h2>

        {/* The figure's reserved space. The 3D scene centres itself on this box;
            the SVG fallback fills it and sizes it itself. */}
        <div
          ref={figureRef}
          className="w-full flex items-center justify-center mb-[clamp(12px,1.8vh,26px)]"
          style={status === 'failed' ? undefined : { height: 'var(--infinity-h, 260px)' }}
        >
          {status === 'failed' && (
            <div className="relative w-full flex justify-center animate-float">
              <InfinitySymbol />
              <div className="absolute top-1/2 left-1/2 w-3/4 h-32 bg-white/5 blur-[80px] rounded-full animate-pulse-glow" />
            </div>
          )}
        </div>

        <h1
          className="text-[clamp(1.5rem,6vw,4rem)] font-normal tracking-[0.35em] text-transparent bg-clip-text bg-gradient-to-r from-[#7dd3fc]/70 via-white to-[#b39dff]/70 animate-shimmer font-['Syncopate'] uppercase animate-fade-in-up reveal-2 leading-none drop-shadow-[0_0_22px_rgba(179,157,255,0.16)]"
          style={{ textIndent: '0.35em' }}
        >
          And Beyond
        </h1>

        <p className="max-w-md mx-auto text-neutral-500 text-[11px] sm:text-xs tracking-[0.2em] mt-9 font-mono text-center uppercase animate-fade-in reveal-3 opacity-75 [@media(max-height:640px)]:hidden">
          EXPLORING THE BOUNDARIES OF MACHINE INTELLIGENCE AND APPLIED AI RESEARCH
        </p>
      </div>

      <a
        href="#projects"
        aria-label="Scroll to projects"
        className="absolute bottom-8 sm:bottom-12 left-1/2 -translate-x-1/2 animate-bounce text-white/30 hover:text-white transition-colors cursor-pointer p-3 [@media(max-height:560px)]:hidden"
      >
        <ArrowDown size={24} />
      </a>
    </section>
  );
};

const ProjectsSection: React.FC = () => {
  return (
    <section id="projects" className="relative z-10 select-none py-24 md:py-36 cursor-default">
      <div className="container mx-auto px-6 md:px-12">
        <div className="grid gap-8 border-b border-white/10 pb-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-neutral-500">
              <span className="h-px w-8 bg-white/25" />
              Selected work
              <span className="text-neutral-600">/ 04</span>
            </div>
            <h2 className="mt-5 font-['Syncopate'] text-[clamp(2.75rem,7vw,5.5rem)] font-bold leading-[0.95] tracking-[-0.06em] text-white">
              WORKS
            </h2>
          </div>

          <div className="lg:col-span-5 lg:max-w-[360px] lg:justify-self-end">
            <p className="font-['Instrument_Serif'] text-2xl italic leading-tight text-neutral-300 md:text-[28px]">
              Research, vision, and systems that earn their place.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-neutral-500">
              Four projects built around real problems — from reading a paper to verifying a cheque to shipping an application end to end.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[9px] uppercase tracking-[0.22em] text-neutral-500">
          <span>Research / NLP</span>
          <span>Computer Vision</span>
          <span>Agent Systems</span>
          <span>Developer Tooling</span>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-12">
          <div className="h-full lg:col-span-1 xl:col-span-7">
            <ProjectCard project={PROJECTS[0]} index={0} />
          </div>
          <div className="h-full lg:col-span-1 xl:col-span-5">
            <ProjectCard project={PROJECTS[1]} index={1} />
          </div>
          <div className="h-full lg:col-span-1 xl:col-span-5">
            <ProjectCard project={PROJECTS[2]} index={2} />
          </div>
          <div className="h-full lg:col-span-1 xl:col-span-7">
            <ProjectCard project={PROJECTS[3]} index={3} />
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-white/[0.06] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
            Selected projects · four systems
          </p>
          <a
            href="https://github.com/redfries"
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500 transition-colors hover:text-white"
          >
            More on GitHub
            <ArrowUpRight size={13} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    </section>
  );
};

const AboutSection: React.FC = () => {
  return (
    <section id="about" className="py-32 relative z-10 bg-[#080808]/80 backdrop-blur-sm select-none cursor-default">
      <div className="container mx-auto px-6 md:px-12">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          {/* Title Column */}
          <div className="lg:col-span-4">
             <h2 className="text-4xl font-bold text-white font-['Syncopate'] mb-8">
               PROFILE
             </h2>
             <div className="w-12 h-1 bg-white mb-8" />
             
             <div className="space-y-4">
                <a href="https://github.com/redfries" target="_blank" rel="noreferrer" className="flex items-center gap-4 text-neutral-400 hover:text-white transition-colors group cursor-pointer">
                  <Github size={20} className="group-hover:scale-110 transition-transform" /> <span className="text-sm tracking-widest">GITHUB</span>
                </a>
                <a href="https://www.linkedin.com/in/redfries/" target="_blank" rel="noreferrer" className="flex items-center gap-4 text-neutral-400 hover:text-white transition-colors group cursor-pointer">
                  <Linkedin size={20} className="group-hover:scale-110 transition-transform" /> <span className="text-sm tracking-widest">LINKEDIN</span>
                </a>
                <a href="mailto:studioinfinitys@gmail.com" className="flex items-center gap-4 text-neutral-400 hover:text-white transition-colors group cursor-pointer">
                  <Mail size={20} className="group-hover:scale-110 transition-transform" /> <span className="text-sm tracking-widest">CONTACT</span>
                </a>
             </div>
          </div>

          {/* Content Column */}
          <div className="lg:col-span-8 space-y-12">
            <p className="text-2xl md:text-4xl text-neutral-300 font-light leading-relaxed">
              I am an AI & Machine Learning Engineer specializing in <span className="text-white font-normal">Deep Learning, Computer Vision, and LLMs</span>. 
              My work bridges cutting-edge research with clean, high-precision engineering.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-white/10">
              <div>
                <h3 className="text-sm text-neutral-500 tracking-[0.2em] mb-4 uppercase">Specialization</h3>
                <ul className="space-y-2 text-neutral-300 font-mono text-sm">
                  <li>Machine Learning (ML)</li>
                  <li>Large Language Models (LLM)</li>
                  <li>Natural Language Processing (NLP)</li>
                  <li>AI Research & Development</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm text-neutral-500 tracking-[0.2em] mb-4 uppercase">Stack</h3>
                <ul className="space-y-2 text-neutral-300 font-mono text-sm">
                  <li>Python / PyTorch / TensorFlow</li>
                  <li>React / TypeScript / Next.js</li>
                  <li>Node.js / FastAPI / SQL</li>
                  <li>LangChain / Hugging Face</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

const Footer: React.FC = () => {
  return (
    <footer className="py-12 relative z-10 border-t border-white/5 bg-black/80 backdrop-blur-sm text-center select-none cursor-default">
      <div className="flex flex-col items-center gap-4">
        <div className="text-white font-['Syncopate'] font-normal tracking-widest">SHABAAZ HUSSAIN</div>
        <p className="text-neutral-600 text-xs font-mono tracking-widest uppercase">
          Designed in the Void // © {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
};

export default function App() {
  const [heroStatus, setHeroStatus] = useState<HeroStatus>('loading');
  const figureRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative bg-black min-h-screen text-slate-200 selection:bg-white selection:text-black">
      {/* The page's whole background, in paint order, all of it fixed and
          viewport-sized at z-0 so every section (z-10) sits above it.

          The hero's canvas lives here rather than inside the hero section, and
          the sky is layered on top of it rather than behind it, because the
          engine's bloom pass composites at alpha 1 — the canvas is opaque black
          wherever the figure is not, so anything behind it is simply not on the
          page. Stars in front of it read correctly anyway: they are faint dots,
          invisible against the lit tubes and visible everywhere else. */}
      <TubesInfinity anchorRef={figureRef} onStatusChange={setHeroStatus} />

      {/* The dot grid is the background of last resort. The 3D starfield behind
          every section replaced it, but this canvas was still mounted
          unconditionally underneath — visible through the transparent hero
          canvas the whole time, and on its own for the second the 3D scene
          spends fading in, which is where the grid appeared to "come back" on
          load. It is now only drawn when there is no 3D scene to replace it. */}
      {heroStatus === 'failed' && <ParticleGrid />}

      <Starfield />

      {/* Navigation */}
      <Header />

      {/* Content */}
      <main>
        <MainHero status={heroStatus} figureRef={figureRef} />
        <ProjectsSection />
        <AboutSection />
      </main>

      <Footer />
    </div>
  );
}