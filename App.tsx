import React, { useEffect, useRef, useState } from 'react';
import {
  Github,
  Linkedin,
  Mail,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Cpu,
  MessageSquare,
  ArrowUp,
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
  steps: string[];
  tags: string[];
  status: string;
  accentColor: string;
  preview?: {
    video: string;
    poster: string;
  };
  links: {
    live?: string;
    github: string;
  };
}

interface Capability {
  id: string;
  title: string;
  summary: string;
  detail: string;
  tools: string[];
  accent: string;
  evidence: { label: string; href: string }[];
}

// --- Constants ---
const PROJECTS: Project[] = [
  {
    id: "arabic-cheque-ocr",
    title: "Arabic Cheque OCR",
    category: "Computer Vision / Model Training",
    tagline: "Reads the cheque. Checks the amount.",
    description: "A system that reads Arabic bank cheques end to end. It finds the important fields, reads handwriting and printed text, then checks that the written amount matches the number.",
    steps: [
      "Finds the payee and amount fields",
      "Reads digits and Arabic handwriting",
      "Flags any amount mismatch"
    ],
    tags: ["Cascade R-CNN", "CRNN + CTC", "Qwen3.5 LoRA"],
    status: "Live system",
    accentColor: "#86efac",
    preview: {
      video: "/projects-card/arabic-cheque-ocr.mp4",
      poster: "/projects-card/arabic-cheque-ocr-poster.jpg"
    },
    links: {
      live: "https://infinitys.me/ocr",
      github: "https://github.com/redfries/arabic-cheque-ocr"
    }
  },
  {
    id: "career-ops",
    title: "Career-Ops",
    category: "AI Automation / Agent Systems",
    tagline: "From job listing to submitted application.",
    description: "An automation system for job applications. It scores how well a role fits, creates a two-page resume for that role, fills the application, and keeps a receipt of what happened.",
    steps: [
      "Checks the role against the candidate profile",
      "Tailors and compiles a two-page resume",
      "Submits through the application site and logs proof"
    ],
    tags: ["Playwright", "SQLite", "Tectonic"],
    status: "Open source",
    accentColor: "#fdba74",
    preview: {
      video: "/projects-card/career-ops.mp4",
      poster: "/projects-card/career-ops-poster.jpg"
    },
    links: {
      github: "https://github.com/redfries/career-ops-automation"
    }
  },
  {
    id: "paper2tex",
    title: "paper2tex",
    category: "Agent Tooling / Developer Tools",
    tagline: "A paper-ready LaTeX file, without the cleanup.",
    description: "An agent skill that converts Word research papers into LaTeX. It keeps equations and figures intact, then handles the common build errors that usually need manual repair.",
    steps: [
      "Converts the manuscript and its equations",
      "Straightens and scales figures",
      "Fixes common build errors"
    ],
    tags: ["Agent skill", "Pandoc", "OMML to LaTeX"],
    status: "Open source",
    accentColor: "#c4b5fd",
    links: {
      github: "https://github.com/redfries/paper2tex"
    }
  },
  {
    id: "reading-with-ai",
    title: "Reading with AI",
    category: "NLP / LLM Systems",
    tagline: "Spend less time finding what matters.",
    description: "A reading tool that learns what you care about and surfaces the most relevant passages in a long research paper, so you can spend more time on the ideas that matter.",
    steps: [
      "Learns your interests from a short profile",
      "Scores each passage against those interests",
      "Highlights the most useful parts"
    ],
    tags: ["Qwen embeddings", "Semantic ranking", "FastAPI"],
    status: "Live app",
    accentColor: "#7dd3fc",
    links: {
      live: "https://infinitys.me/pre",
      github: "https://github.com/redfries/personalized-reading-experience"
    }
  }
];

const CAPABILITIES: Capability[] = [
  {
    id: "capability-llm",
    title: "LLM Systems",
    summary: "Language models that retrieve, rank, and answer inside a real workflow.",
    detail: "Fine-tuning with LoRA, embedding-based retrieval, semantic ranking, and evaluation against the task the model is actually meant to do.",
    tools: ["Qwen", "LoRA / PEFT", "Embeddings", "Semantic ranking", "Transformers"],
    accent: "#7dd3fc",
    evidence: [
      { label: "Reading with AI", href: "https://infinitys.me/pre" },
      { label: "Arabic Cheque OCR", href: "https://infinitys.me/ocr" },
    ],
  },
  {
    id: "capability-training",
    title: "Model Training",
    summary: "Domain models trained on real data, with failure analysis that means something.",
    detail: "Dataset design, detection and recognition training, and evaluation that shows where a model breaks instead of only how often it is right.",
    tools: ["PyTorch", "Detectron2", "Cascade R-CNN", "CRNN + CTC", "OpenCV"],
    accent: "#86efac",
    evidence: [
      { label: "Arabic Cheque OCR", href: "https://infinitys.me/ocr" },
    ],
  },
  {
    id: "capability-vision-language",
    title: "Vision & Language",
    summary: "Messy documents, handwriting, and Arabic text turned into structured data.",
    detail: "Field detection, handwriting recognition, PDF extraction, and language models tuned for documents people already use.",
    tools: ["Arabic NLP", "Document AI", "PyMuPDF", "Streamlit", "FastAPI"],
    accent: "#e7d3a1",
    evidence: [
      { label: "Arabic Cheque OCR", href: "https://infinitys.me/ocr" },
      { label: "Reading with AI", href: "https://infinitys.me/pre" },
    ],
  },
  {
    id: "capability-agents",
    title: "Agents & Automation",
    summary: "Work that runs end to end, with a visible record of every step.",
    detail: "Tool use, browser automation, state, retries, and receipts, built so a broken step can be found and fixed.",
    tools: ["Playwright", "Tool use", "SQLite", "Stateful pipelines", "Tectonic"],
    accent: "#fdba74",
    evidence: [
      { label: "Career-Ops", href: "https://github.com/redfries/career-ops-automation" },
      { label: "paper2tex", href: "https://github.com/redfries/paper2tex" },
    ],
  },
];

const STACK_GROUPS = [
  {
    label: "Modeling & training",
    items: ["Python", "PyTorch", "Transformers", "PEFT / LoRA", "Detectron2"],
  },
  {
    label: "Language & retrieval",
    items: ["Qwen", "Embeddings", "CRNN + CTC", "Semantic ranking", "Arabic NLP"],
  },
  {
    label: "Systems & delivery",
    items: ["FastAPI", "Modal", "Streamlit", "SQLite", "Playwright"],
  },
  {
    label: "Interface",
    items: ["React", "TypeScript", "Vite", "Tailwind CSS"],
  },
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
            <span className="md:hidden"><Cpu size={20} /></span>
            <span className="hidden md:block text-xs font-bold tracking-[0.2em] uppercase">Capabilities</span>
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
  <div className="absolute inset-0 overflow-hidden bg-[#050508]/78">
    <div className="showcase-grid absolute inset-0 opacity-60" />
    <div
      className="absolute inset-0"
      style={{ background: `radial-gradient(90% 80% at 50% 115%, ${accentColor}1f, transparent 65%)` }}
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

const useReducedMotion = () => {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(query.matches);

    updatePreference();
    query.addEventListener('change', updatePreference);
    return () => query.removeEventListener('change', updatePreference);
  }, []);

  return reducedMotion;
};

const ProjectVideo: React.FC<{ project: Project }> = ({ project }) => {
  const reducedMotion = useReducedMotion();
  if (!project.preview) return null;

  return (
    <div className="absolute inset-0 bg-[#050508]/78">
      <div className="showcase-grid absolute inset-0 opacity-30" />
      <video
        className="relative h-full w-full object-contain"
        autoPlay={!reducedMotion}
        loop={!reducedMotion}
        muted
        playsInline
        preload="metadata"
        poster={project.preview.poster}
        aria-hidden="true"
      >
        <source src={project.preview.video} type="video/mp4" />
      </video>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.12),transparent_24%,transparent_76%,rgba(0,0,0,0.26))]" />
    </div>
  );
};

const ProjectPreview: React.FC<{ project: Project }> = ({ project }) => (
  project.preview
    ? <ProjectVideo project={project} />
    : <ProjectVisual projectId={project.id} />
);

const ProjectCard: React.FC<{ project: Project; index: number }> = ({ project, index }) => {
  const href = project.links.live ?? project.links.github;
  const linkLabel = project.links.live ? 'View live project' : 'View source on GitHub';

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`${linkLabel}: ${project.title}`}
      data-illuminate-card={`project-${project.id}`}
      data-accent-color={project.accentColor}
      className="showcase-card illuminated-card group relative grid overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#07080c]/86 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/40 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]"
    >
      <div
        className="pointer-events-none absolute inset-0 z-20 opacity-0 transition-opacity duration-700 group-hover:opacity-100"
        style={{ background: `radial-gradient(65% 55% at 16% 12%, ${project.accentColor}16, transparent 72%)` }}
      />

      <div className="relative min-h-[260px] overflow-hidden border-b border-white/[0.07] sm:min-h-[320px] lg:min-h-[440px] lg:border-b-0 lg:border-r">
        <ProjectPreview project={project} />
      </div>

      <div className="relative z-10 flex flex-col p-7 md:p-9 lg:p-10 xl:p-11">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-5 font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-400">
          <div className="flex items-center gap-3">
            <span className="text-neutral-200">{String(index + 1).padStart(2, '0')}</span>
            <span className="h-px w-5 bg-white/15" />
            <span>{project.category}</span>
          </div>
          <span className="rounded-full border border-white/[0.1] px-2.5 py-1 tracking-[0.14em] text-neutral-300">
            {project.status}
          </span>
        </div>

        <h3 className="mt-7 font-['Syncopate'] text-[clamp(1.55rem,3vw,2.35rem)] font-bold leading-[1.08] tracking-[-0.035em] text-white">
          {project.title}
        </h3>
        <p className="mt-4 font-['Instrument_Serif'] text-[clamp(1.25rem,2vw,1.55rem)] italic leading-[1.25] text-neutral-100">
          {project.tagline}
        </p>
        <p className="card-readable-copy mt-5 max-w-[56ch] text-[15px] leading-7 text-neutral-300 transition-colors duration-300">
          {project.description}
        </p>

        <div className="mt-7 border-t border-white/[0.07] pt-5">
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-neutral-500">How it works</p>
          <ol className="mt-4 space-y-3">
            {project.steps.map((step, stepIndex) => (
              <li key={step} className="card-readable-step flex gap-3 text-[13px] leading-5 text-neutral-300 transition-colors duration-300">
                <span className="mt-0.5 font-mono text-[9px] text-neutral-500">0{stepIndex + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {project.tags.map(tag => (
            <span key={tag} className="rounded-full border border-white/[0.09] bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] tracking-wide text-neutral-300 transition-colors duration-500 group-hover:border-white/[0.18] group-hover:text-white">
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between gap-5 pt-8">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400 transition-colors duration-500 group-hover:text-white">
            {linkLabel}
          </span>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-neutral-300 transition-all duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:border-white/25 group-hover:text-white">
            <ArrowUpRight size={16} />
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

const MainHero: React.FC<{
  status: HeroStatus;
  figureRef: React.RefObject<HTMLDivElement | null>;
}> = ({ status, figureRef }) => {
  return (
    <section
      id="hero-section"
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
          data-testid="hero-infinity-anchor"
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

        <p className="mx-auto mt-9 max-w-xl text-center text-sm leading-7 text-neutral-400 animate-fade-in reveal-3 opacity-85 sm:text-base [@media(max-height:640px)]:hidden">
          I train models, build with LLMs, and design AI agents that turn difficult work into dependable automation.
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
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-neutral-400">
              <span className="h-px w-8 bg-white/25" />
              Selected work
              <span className="text-neutral-500">/ 04</span>
            </div>
            <h2 className="mt-5 font-['Syncopate'] text-[clamp(2.75rem,7vw,5.5rem)] font-bold leading-[0.95] tracking-[-0.06em] text-white">
              AI SYSTEMS
            </h2>
          </div>

          <div className="lg:col-span-5 lg:max-w-[420px] lg:justify-self-end">
            <p className="font-['Instrument_Serif'] text-2xl italic leading-tight text-neutral-200 md:text-[30px]">
              Model training, LLM systems, and agents built for real work.
            </p>
            <p className="mt-4 text-sm leading-6 text-neutral-400">
              I start with a difficult workflow, train or connect the right models, and build the system around them so it can be used in practice.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[9px] uppercase tracking-[0.22em] text-neutral-400">
          <span>Model training</span>
          <span className="h-1 w-1 rounded-full bg-neutral-700" />
          <span>LLM systems</span>
          <span className="h-1 w-1 rounded-full bg-neutral-700" />
          <span>AI agents</span>
          <span className="h-1 w-1 rounded-full bg-neutral-700" />
          <span>Applied automation</span>
        </div>

        <div className="mt-10 space-y-6">
          {PROJECTS.map((project, index) => (
            <ProjectCard key={project.id} project={project} index={index} />
          ))}
        </div>

        <div className="mt-8 flex flex-col items-end border-t border-white/[0.06] pt-6 sm:flex-row sm:items-center sm:justify-end">
          <a
            href="https://github.com/redfries"
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400 transition-colors hover:text-white"
          >
            More on GitHub
            <ArrowUpRight size={13} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    </section>
  );
};

const CapabilityRow: React.FC<{ capability: Capability; index: number }> = ({ capability, index }) => (
  <article
    id={capability.id}
    data-illuminate-card={capability.id}
    data-accent-color={capability.accent}
    className="illuminated-card group scroll-mt-24 overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#07080c]/86 px-6 transition-colors duration-500 md:px-9"
  >
    <div className="relative z-10 grid gap-6 py-8 md:grid-cols-12 md:gap-8 md:py-10">
      <div className="flex items-center gap-4 md:col-span-1 md:items-start">
        <span className="font-mono text-[10px] tracking-[0.2em] text-neutral-400">
          0{index + 1}
        </span>
        <span className="h-px w-6 bg-white/10 md:hidden" />
      </div>

      <div className="md:col-span-5">
        <div className="flex items-center gap-3">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: capability.accent }}
          />
          <h3 className="font-['Syncopate'] text-[clamp(1.2rem,2.4vw,1.75rem)] font-bold tracking-[-0.03em] text-white">
            {capability.title}
          </h3>
        </div>
        <p className="mt-4 max-w-[46ch] font-['Instrument_Serif'] text-[clamp(1.22rem,1.9vw,1.5rem)] italic leading-[1.3] text-neutral-100">
          {capability.summary}
        </p>
        <p className="card-readable-copy mt-3 max-w-[52ch] text-sm leading-6 text-neutral-300 transition-colors duration-300">
          {capability.detail}
        </p>
      </div>

      <div className="flex flex-col justify-between gap-6 md:col-span-6 md:pl-4">
        <div className="flex flex-wrap content-start gap-2">
          {capability.tools.map((tool) => (
            <span
              key={tool}
              className="rounded-full border border-white/[0.09] bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] tracking-wide text-neutral-300 transition-colors duration-500 group-hover:border-white/[0.16] group-hover:text-white"
            >
              {tool}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.07] pt-4 font-mono text-[9px] uppercase tracking-[0.18em] text-neutral-400">
          <span>Built in</span>
          {capability.evidence.map((item) => (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="group/link inline-flex items-center gap-1.5 text-neutral-300 transition-colors hover:text-white"
            >
              {item.label}
              <ArrowUpRight
                size={11}
                className="transition-transform duration-300 group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5"
              />
            </a>
          ))}
        </div>
      </div>
    </div>
  </article>
);

const TOOLKIT_ACCENTS = ['#7dd3fc', '#c4b5fd', '#86efac', '#fdba74'];

const AboutSection: React.FC = () => {
  return (
    <section
      id="about"
      className="relative z-10 scroll-mt-20 border-t border-white/[0.06] py-24 select-none cursor-default md:py-32"
    >
      <div className="container mx-auto px-6 md:px-12">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-neutral-400">
              <span className="h-px w-8 bg-white/25" />
              Capabilities
              <span className="text-neutral-500">/ 04</span>
            </div>
            <h2 className="mt-5 font-['Syncopate'] text-[clamp(2.6rem,6.6vw,5.5rem)] font-bold leading-[0.95] tracking-[-0.06em] text-white">
              FROM MODEL
              <br />
              TO SYSTEM
            </h2>
          </div>

          <div className="lg:col-span-5 lg:max-w-[430px] lg:justify-self-end">
            <p className="font-['Instrument_Serif'] text-2xl italic leading-tight text-neutral-200 md:text-[30px]">
              The model is one part. The system around it is the job.
            </p>
            <p className="mt-4 text-sm leading-6 text-neutral-400">
              I work across data, training, evaluation, and delivery, usually on workflows where a wrong answer has a cost. These are the four areas where most of that work happens.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-400">
          {["Machine learning", "LLM systems", "Model training", "Computer vision", "NLP", "Agents"].map((area, index) => (
            <span key={area} className="flex items-center gap-4">
              {index > 0 && <span className="h-1 w-1 rounded-full bg-neutral-700" />}
              {area}
            </span>
          ))}
        </div>

        <div className="mt-10 space-y-4 md:mt-14">
          {CAPABILITIES.map((capability, index) => (
            <CapabilityRow key={capability.id} capability={capability} index={index} />
          ))}
        </div>

        <div className="mt-16 grid gap-10 border-t border-white/[0.08] pt-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-3">
            <div className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.24em] text-neutral-400">
              <span className="h-px w-6 bg-white/20" />
              Toolkit
            </div>
            <h3 className="mt-4 font-['Syncopate'] text-2xl font-bold tracking-[-0.03em] text-white">
              BY LAYER
            </h3>
            <p className="mt-3 max-w-[30ch] text-sm leading-6 text-neutral-400">
              The tools I reach for most often, grouped by the part of the system they serve.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4 lg:col-span-9">
            {STACK_GROUPS.map((group, idx) => (
              <div
                key={group.label}
                data-illuminate-card={`toolkit-layer-${idx + 1}`}
                data-accent-color={TOOLKIT_ACCENTS[idx % TOOLKIT_ACCENTS.length]}
                className="illuminated-card overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#07080c]/86 p-6"
              >
                <div className="relative z-10">
                  <p className="border-b border-white/[0.08] pb-3 font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-300">
                    {group.label}
                  </p>
                  <ul className="mt-4 space-y-2.5">
                    {group.items.map((item) => (
                      <li
                        key={item}
                        className="card-readable-copy text-[13px] leading-5 text-neutral-300 transition-colors duration-300 hover:text-white"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer
      id="contact"
      className="relative z-10 scroll-mt-20 overflow-hidden border-t border-white/[0.07]"
    >
      <div
        className="pointer-events-none absolute right-[-3rem] top-1/2 hidden w-[min(700px,52vw)] -translate-y-1/2 text-white/[0.045] lg:block"
        aria-hidden="true"
      >
        <svg viewBox="0 0 200 100" fill="none" className="w-full">
          <path
            d="M100 50 C 72 18, 24 18, 24 50 C 24 82, 72 82, 100 50 C 128 18, 176 18, 176 50 C 176 82, 128 82, 100 50"
            stroke="currentColor"
            strokeWidth="0.8"
          />
        </svg>
      </div>

      <div className="container relative mx-auto px-6 pb-8 pt-24 md:px-12 md:pt-32">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div
            data-illuminate-card="contact-primary"
            data-accent-color="#7dd3fc"
            className="illuminated-card overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#07080c]/86 p-8 md:p-10 lg:col-span-7"
          >
            <div className="relative z-10">
              <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-neutral-400">
                <span className="h-px w-8 bg-white/25" />
                Contact
                <span className="text-neutral-500">/ 01</span>
              </div>
              <h2 className="mt-6 font-['Syncopate'] text-[clamp(2.35rem,6.2vw,4.8rem)] font-bold leading-[0.95] tracking-[-0.055em] text-white">
                HAVE A HARD
                <br />
                PROBLEM<span className="text-neutral-500">?</span>
              </h2>
              <p className="mt-6 font-['Instrument_Serif'] text-[clamp(1.75rem,3vw,2.5rem)] italic leading-[1.1] text-neutral-100">
                Good. That&apos;s the interesting part.
              </p>
              <p className="card-readable-copy mt-6 max-w-[52ch] text-sm leading-7 text-neutral-300">
                Send the workflow, the data, or the step that keeps failing. I&apos;ll tell you what it would take to make it dependable.
              </p>

              <a
                href="mailto:studioinfinitys@gmail.com"
                className="group mt-10 flex items-center justify-between gap-5 border-y border-white/[0.12] py-5 transition-colors duration-500 hover:border-white/30"
              >
                <span className="break-all font-mono text-[clamp(0.92rem,2.3vw,1.35rem)] tracking-[-0.02em] text-neutral-100 transition-colors duration-500 group-hover:text-white">
                  studioinfinitys@gmail.com
                </span>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 text-neutral-300 transition-all duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:border-white/30 group-hover:text-white">
                  <ArrowUpRight size={17} />
                </span>
              </a>
            </div>
          </div>

          <div
            data-illuminate-card="contact-elsewhere"
            data-accent-color="#c4b5fd"
            className="illuminated-card flex flex-col justify-between gap-10 overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#07080c]/86 p-8 md:p-10 lg:col-span-5"
          >
            <div className="relative z-10">
              <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-neutral-400">
                Currently building
              </p>
              <ul className="mt-5 space-y-4">
                {[
                  "Document intelligence for Arabic records",
                  "LLM systems with evaluation built in",
                  "Agents that leave a record of every step",
                ].map((item) => (
                  <li key={item} className="card-readable-copy flex gap-3 text-sm leading-6 text-neutral-300">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-300/70" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative z-10">
              <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-neutral-400">
                Elsewhere
              </p>
              <div className="mt-4 border-t border-white/[0.08]">
                {[
                  { label: "GitHub", meta: "/redfries", href: "https://github.com/redfries" },
                  { label: "LinkedIn", meta: "/in/redfries", href: "https://www.linkedin.com/in/redfries/" },
                ].map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center justify-between gap-4 border-b border-white/[0.08] py-4 text-sm text-neutral-200 transition-colors duration-300 hover:text-white"
                  >
                    <span>{link.label}</span>
                    <span className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.16em] text-neutral-400 transition-colors group-hover:text-neutral-200">
                      {link.meta}
                      <ArrowUpRight
                        size={12}
                        className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      />
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-5 border-t border-white/[0.08] pt-6 font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="text-neutral-200">Shabaaz Hussain</span>
            <span className="hidden h-1 w-1 rounded-full bg-neutral-700 sm:block" />
            <span>AI &amp; ML Engineer</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span>&copy; {year} &middot; Designed in the void</span>
            <a
              href="#top"
              className="group inline-flex items-center gap-1.5 text-neutral-300 transition-colors duration-300 hover:text-white"
            >
              Back to top
              <ArrowUp
                size={11}
                className="transition-transform duration-300 group-hover:-translate-y-0.5"
              />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default function App() {
  const [heroStatus, setHeroStatus] = useState<HeroStatus>('loading');
  const figureRef = useRef<HTMLDivElement>(null);

  return (
    <div id="top" className="relative bg-black min-h-screen text-slate-200 selection:bg-white selection:text-black">
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