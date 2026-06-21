import React, { useEffect, useRef, useState } from 'react';
import { Github, Linkedin, Mail, ExternalLink, ArrowRight, ArrowDown, Briefcase, User, MessageSquare } from 'lucide-react';

// --- Types ---
interface Project {
  id: number;
  title: string;
  category: string;
  description: string;
  tags: string[];
  image: string;
  link: string;
}

// --- Constants ---
const PROJECTS: Project[] = [
  {
    id: 1,
    title: "Reading with AI",
    category: "RESEARCH",
    description: "Personalized reading experience. Not every sentence deserves your time. Qwen AI research.",
    tags: ["LLM", "NLP", "Qwen AI"],
    image: "https://picsum.photos/600/400?random=1",
    link: "https://infinitys.me/pre"
  },
  {
    id: 2,
    title: "Cheque OCR",
    category: "COMPUTER VISION",
    description: "End-to-end Arabic cheque field localization, OCR, and verification. Cascade R-CNN + CRNN + Qwen3.5 LoRA.",
    tags: ["Detectron2", "PyTorch", "Qwen3.5"],
    image: "https://picsum.photos/600/400?random=2",
    link: "https://infinitys.me/ocr"
  },
  {
    id: 3,
    title: "STARLIGHT",
    category: "MOBILE AR",
    description: "Cross-platform AR application for constellation identification.",
    tags: ["React Native", "ARKit", "Expo"],
    image: "https://picsum.photos/600/400?random=3",
    link: "#"
  },
  {
    id: 4,
    title: "QUANTUM API",
    category: "BACKEND",
    description: "Secure, high-velocity endpoints for quantum simulation clusters.",
    tags: ["Go", "gRPC", "Kubernetes"],
    image: "https://picsum.photos/600/400?random=4",
    link: "#"
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
      canvas.width = width;
      canvas.height = height;
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
        <div className="text-xl font-normal tracking-[0.2em] text-white flex items-center gap-2 font-['Syncopate'] cursor-default select-none">
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

const ProjectCard: React.FC<{ project: Project }> = ({ project }) => {
  return (
    <a href={project.link} target={project.link.startsWith('http') ? "_blank" : "_self"} rel="noreferrer" className="group cred-card relative overflow-hidden h-[400px] flex flex-col justify-end p-8 md:p-10 cursor-pointer">
      {/* Background Image that reveals on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-40 transition-opacity duration-700 ease-out z-0">
        <img 
          src={project.image} 
          alt={project.title} 
          className="w-full h-full object-cover grayscale mix-blend-luminosity scale-105 group-hover:scale-100 transition-transform duration-700" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
      </div>

      <div className="relative z-10 space-y-4">
        <div className="flex justify-between items-end border-b border-white/20 pb-4 mb-4 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
           <div>
             <span className="text-xs font-bold text-neutral-500 tracking-widest uppercase mb-1 block">{project.category}</span>
             <h3 className="text-3xl font-bold text-white tracking-tight font-['Syncopate']">
               {project.title}
             </h3>
           </div>
           <ArrowRight className="text-white opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all duration-500" />
        </div>
        
        <p className="text-neutral-400 text-sm leading-relaxed max-w-sm opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500 delay-100">
          {project.description}
        </p>

        <div className="flex gap-3 pt-2 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500 delay-200">
          {project.tags.map((tag, i) => (
            <span key={i} className="text-[10px] font-mono border border-white/20 px-2 py-1 text-white/80 uppercase">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </a>
  );
};

const InfinitySymbol: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    viewBox="0 0 200 100" 
    className={`w-full max-w-[600px] h-auto text-white ${className}`}
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

const MainHero: React.FC = () => {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center relative z-10 px-6 overflow-hidden select-none cursor-default">
      
      <div className="w-full max-w-5xl mx-auto text-center flex flex-col items-center gap-6">
        
        {/* Top Text - Lowered slightly with larger margin */}
        <h2 className="text-xl md:text-3xl font-light tracking-[0.8em] text-neutral-500 uppercase animate-fade-in-up mt-24">
          To
        </h2>

        {/* Centerpiece Symbol - Floating with Pulse */}
        <div className="relative py-10 md:py-14 w-full flex justify-center animate-fade-in duration-1000 delay-300 animate-float">
           <InfinitySymbol />
           {/* Breathing Glow Effect */}
           <div className="absolute top-1/2 left-1/2 w-3/4 h-32 bg-white/5 blur-[80px] rounded-full pointer-events-none animate-pulse-glow" />
        </div>

        {/* Bottom Text - Shimmering */}
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-neutral-600 via-white to-neutral-600 animate-shimmer font-['Syncopate'] uppercase animate-fade-in-up delay-500">
          And Beyond
        </h1>

        <p className="max-w-md mx-auto text-neutral-500 text-sm md:text-base tracking-widest mt-10 font-mono border-l border-white/20 pl-4 text-left">
          EXPLORING THE BOUNDARIES OF DIGITAL INTERACTION AND MINIMALIST DESIGN.
        </p>

      </div>
      
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 animate-bounce text-white/30 hover:text-white transition-colors cursor-pointer">
        <ArrowDown size={24} />
      </div>
    </section>
  );
};

const ProjectsSection: React.FC = () => {
  return (
    <section id="projects" className="py-32 relative z-10 select-none cursor-default">
      <div className="container mx-auto px-6 md:px-12">
        <div className="flex flex-col md:flex-row items-end justify-between mb-20 pb-6 border-b border-white/10 gap-6">
          <h2 className="text-5xl md:text-7xl font-bold text-white font-['Syncopate'] tracking-tighter opacity-90">
            WORKS
          </h2>
          <span className="text-neutral-500 font-mono text-sm tracking-widest mb-2">
            PROJECTS
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {PROJECTS.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </section>
  );
};

const AboutSection: React.FC = () => {
  return (
    <section id="about" className="py-32 relative z-10 bg-[#080808] select-none cursor-default">
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
              I am a digital craftsman focused on creating <span className="text-white font-normal">immersive web experiences</span>. 
              My work bridges the gap between engineered precision and artistic fluidity.
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
    <footer className="py-12 relative z-10 border-t border-white/5 bg-black text-center select-none cursor-default">
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
  return (
    <div className="relative bg-black min-h-screen text-slate-200 selection:bg-white selection:text-black">
      {/* Background Interactive Layer */}
      <ParticleGrid />
      
      {/* Navigation */}
      <Header />
      
      {/* Content */}
      <main>
        <MainHero />
        <ProjectsSection />
        <AboutSection />
      </main>

      <Footer />
    </div>
  );
}