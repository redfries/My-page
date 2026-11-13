import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BookOpenCheck,
  BrainCircuit,
  FileCode2,
  Github,
  Layers,
  Linkedin,
  Mail,
  ScanText,
  Workflow,
} from 'lucide-react';
import TubesInfinity, { heroWarp, type HeroStatus } from './TubesInfinity';
import Starfield from './Starfield';
import PaperTransition from './PaperTransition';

// --- Types ---
interface Project {
  id: string;
  title: string;
  category: string;
  discipline: 'Vision' | 'Language' | 'Agents' | 'Tooling';
  tagline: string;
  description: string;
  tags: string[];
  status: string;
  caption: string;
  video?: {
    src: string;
    poster: string;
  };
  links: {
    live?: string;
    github: string;
  };
}

interface Capability {
  title: string;
  body: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}

// --- Content ---
const PROJECTS: Project[] = [
  {
    id: 'arabic-cheque-ocr',
    title: 'Arabic Cheque OCR',
    category: 'Computer vision · Document AI',
    discipline: 'Vision',
    tagline: 'Reads the cheque. Checks the amount.',
    description:
      'A system that reads Arabic bank cheques end to end: field detection, handwriting and print recognition, then a cross-check that the written amount matches the number.',
    tags: ['Cascade R-CNN', 'CRNN + CTC', 'Qwen3.5 LoRA'],
    status: 'Live system',
    caption: 'Field detection → handwriting and print recognition → amount cross-check',
    video: {
      src: '/projects-card/arabic-cheque-ocr.mp4',
      poster: '/projects-card/arabic-cheque-ocr-poster.jpg',
    },
    links: {
      live: 'https://infinitys.me/ocr',
      github: 'https://github.com/redfries/arabic-cheque-ocr',
    },
  },
  {
    id: 'reading-with-ai',
    title: 'Reading with AI',
    category: 'NLP · Retrieval',
    discipline: 'Language',
    tagline: 'Spend less time finding what matters.',
    description:
      'Learns what a reader cares about from a short profile, scores every passage against those interests, and surfaces the parts of a long paper worth the time.',
    tags: ['Qwen embeddings', 'Semantic ranking', 'FastAPI'],
    status: 'Live app',
    caption: 'Interest profile → passage scoring → focused reading',
    links: {
      live: 'https://infinitys.me/pre',
      github: 'https://github.com/redfries/personalized-reading-experience',
    },
  },
  {
    id: 'career-ops',
    title: 'Career-Ops',
    category: 'AI agents · Automation',
    discipline: 'Agents',
    tagline: 'From job listing to submitted application.',
    description:
      'Scores a role against a candidate profile, tailors and compiles a two-page resume, submits through the application site, and keeps a receipt of what happened.',
    tags: ['Playwright', 'SQLite', 'Tectonic'],
    status: 'Open source',
    caption: 'Role match → tailored resume → verified submission',
    video: {
      src: '/projects-card/career-ops.mp4',
      poster: '/projects-card/career-ops-poster.jpg',
    },
    links: {
      github: 'https://github.com/redfries/career-ops-automation',
    },
  },
  {
    id: 'paper2tex',
    title: 'paper2tex',
    category: 'Developer tooling · Documents',
    discipline: 'Tooling',
    tagline: 'Paper-ready LaTeX, without the cleanup.',
    description:
      'An agent skill that converts Word manuscripts into LaTeX while keeping equations and figures intact, then repairs the build failures that usually need a human.',
    tags: ['Agent skill', 'Pandoc', 'OMML → LaTeX'],
    status: 'Open source',
    caption: 'Word manuscript → equations preserved → paper-ready LaTeX',
    links: {
      github: 'https://github.com/redfries/paper2tex',
    },
  },
];


const CAPABILITIES: Capability[] = [
  {
    title: 'LLM systems',
    body: 'Retrieval, ranking, and fine-tuning built around the task, with evaluation that shows where the model fails.',
    icon: BrainCircuit,
  },
  {
    title: 'Model training',
    body: 'Dataset design, detection and recognition training, and failure analysis that points to the next fix.',
    icon: Layers,
  },
  {
    title: 'Vision & language',
    body: 'Messy documents, handwriting, and Arabic text turned into structured, checkable data.',
    icon: ScanText,
  },
  {
    title: 'Agents & automation',
    body: 'Tool use, browser automation, state, retries, and receipts, so a broken step can be found and fixed.',
    icon: Workflow,
  },
];

const TOOLKIT = [
  'Python',
  'PyTorch',
  'Transformers',
  'PEFT / LoRA',
  'Detectron2',
  'Qwen',
  'Embeddings',
  'CRNN + CTC',
  'Arabic NLP',
  'FastAPI',
  'Modal',
  'Streamlit',
  'SQLite',
  'Playwright',
  'Tectonic',
  'React',
  'TypeScript',
  'Vite',
];

const PROJECT_ICONS: Record<
  string,
  React.ComponentType<{ size?: number; strokeWidth?: number }>
> = {
  'arabic-cheque-ocr': ScanText,
  'reading-with-ai': BookOpenCheck,
  'career-ops': Workflow,
  paper2tex: FileCode2,
};

// --- Background fallback ---

/**
 * ParticleGrid Component
 * A strict, engineered grid that distorts with mouse movement.
 * Mounted only when the WebGL hero reports a failure.
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

    const spacing = 45;
    const radius = 1.2;
    const mouseRadius = 200;
    const returnSpeed = 0.08;
    const pushFactor = 0.5;

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
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      points = [];

      const cols = Math.ceil(width / spacing) + 2;
      const rows = Math.ceil(height / spacing) + 2;

      for (let i = -1; i < cols; i++) {
        for (let j = -1; j < rows; j++) {
          const x = i * spacing;
          const y = j * spacing;
          points.push({ x, y, originX: x, originY: y, vx: 0, vy: 0 });
        }
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      points.forEach((point) => {
        const dx = mouseX - point.x;
        const dy = mouseY - point.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < mouseRadius) {
          const angle = Math.atan2(dy, dx);
          const force = (mouseRadius - distance) / mouseRadius;
          const moveX = Math.cos(angle) * force * spacing * pushFactor;
          const moveY = Math.sin(angle) * force * spacing * pushFactor;
          point.vx -= moveX * 0.1;
          point.vy -= moveY * 0.1;
        }

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

        const homeDx = point.originX - point.x;
        const homeDy = point.originY - point.y;
        point.vx += homeDx * returnSpeed;
        point.vy += homeDy * returnSpeed;
        point.vx *= 0.8;
        point.vy *= 0.8;
        point.x += point.vx;
        point.y += point.vy;

        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.05, 0.15 - distance / 1000)})`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    const handleResize = () => init();

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
      className="particle-grid"
      aria-hidden="true"
    />
  );
};

const Header: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`site-header ${isScrolled ? 'is-scrolled' : ''}`}>
      <div className="shell header-inner">
        <a href="#top" className="brand" aria-label="Shabaaz Hussain, back to top">
          <span className="brand__mark" aria-hidden="true">SH</span>
          <span>shabaaz hussain</span>
        </a>

        <nav className="nav" aria-label="Primary">
          <a href="#work">work</a>
          <a href="#approach">approach</a>
          <a href="#contact">contact</a>
          <div className="nav__socials">
            <a href="https://github.com/redfries" target="_blank" rel="noreferrer" aria-label="GitHub">
              <Github size={16} />
            </a>
            <a href="https://www.linkedin.com/in/redfries/" target="_blank" rel="noreferrer" aria-label="LinkedIn">
              <Linkedin size={16} />
            </a>
            <a href="mailto:studioinfinitys@gmail.com" aria-label="Email">
              <Mail size={16} />
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
};

const InfinitySymbol: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 200 100"
    className={`infinity-symbol ${className ?? ''}`}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M100 50 C 100 50, 150 100, 175 75 C 200 50, 150 0, 100 50 C 50 100, 0 50, 25 25 C 50 0, 100 50, 100 50"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="infinity-path"
    />
  </svg>
);

const MainHero: React.FC<{
  status: HeroStatus;
  figureRef: React.RefObject<HTMLDivElement | null>;
}> = ({ status, figureRef }) => {
  return (
    <section className="hero-section" style={{ minHeight: '100svh' }}>
      <div className="hero-content">
        <p className="hero-kicker">To</p>

        <div
          ref={figureRef}
          className="hero-figure"
          style={status === 'failed' ? undefined : { height: 'var(--infinity-h, 260px)' }}
        >
          {status === 'failed' && (
            <div className="hero-figure__fallback">
              <InfinitySymbol />
              <div className="hero-figure__glow" />
            </div>
          )}
        </div>

        <h1 className="hero-title">And Beyond</h1>

        <p className="hero-tagline">
          <span className="hero-tagline__lead">I train models, build with LLMs, and design AI agents.</span>
          <span className="hero-tagline__detail">Turning difficult work into dependable systems.</span>
        </p>
      </div>

      <a href="#work" aria-label="Scroll to selected work" className="hero-scroll">
        <ArrowDown size={24} />
      </a>
    </section>
  );
};

const SectionEyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="eyebrow">{children}</p>
);

const ApproachSection: React.FC = () => (
  <section id="approach" className="paper-section section-approach">
    <div className="shell">
      <div className="section-copy">
        <SectionEyebrow>approach</SectionEyebrow>
        <h2 className="display">
          The model is one part. The <strong>system</strong> is the job.
        </h2>
        <p className="lede">
          I work from the workflow backwards: data, training, evaluation, and the interface that makes
          the result usable. Usually on problems where a wrong answer has a cost.
        </p>
      </div>

      <div className="cap-grid">
        {CAPABILITIES.map((capability) => {
          const Icon = capability.icon;
          return (
            <article key={capability.title} className="cap-item">
              <span className="cap-item__icon" aria-hidden="true">
                <Icon size={40} strokeWidth={1.15} />
              </span>
              <div>
                <h3>{capability.title}</h3>
                <p>{capability.body}</p>
              </div>
            </article>
          );
        })}
      </div>

    </div>
  </section>
);

const ToolkitSection: React.FC = () => (
  <section className="toolkit-section" aria-labelledby="toolkit-title">
      <div className="shell toolkit">
        <div className="toolkit__head">
          <h2 id="toolkit-title" className="toolkit__label">toolkit</h2>
          <span className="toolkit__count">{TOOLKIT.length} tools</span>
        </div>
        <div className="toolkit__track">
          <div className="toolkit__rail">
            {TOOLKIT.map((tool) => (
              <span className="toolkit__item" key={tool}>{tool}</span>
            ))}
            {TOOLKIT.map((tool) => (
              <span className="toolkit__item toolkit__item--dup" key={`${tool}-dup`} aria-hidden="true">
                {tool}
              </span>
            ))}
          </div>
        </div>
      </div>
  </section>
);

const useReducedMotion = () => {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
};

const ProjectVideo: React.FC<{ src: string; poster: string }> = ({ src, poster }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion) return;

    // Prepare the small clips before they enter view, instead of making the
    // first scroll pay for download and decoder startup together.
    const prepare = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      video.preload = 'auto';
      video.load();
      prepare.disconnect();
    }, { rootMargin: '600px' });
    prepare.observe(video);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(video);
    return () => {
      prepare.disconnect();
      observer.disconnect();
      video.pause();
    };
  }, [reducedMotion]);

  if (reducedMotion) {
    return <img className="project-media__image" src={poster} alt="" />;
  }

  return (
    <video
      ref={videoRef}
      className="project-media__video"
      poster={poster}
      loop
      muted
      playsInline
      preload="none"
      aria-hidden="true"
    >
      <source src={src} type="video/mp4" />
    </video>
  );
};

const ReadingPreview: React.FC = () => (
  <div className="reading-mock" aria-hidden="true">
    <div className="reading-mock__top">
      <span>arXiv / 2603.0142</span>
      <span>12 / 28</span>
    </div>
    <div className="reading-mock__title" />
    <div className="reading-mock__rule" />
    <div className="reading-lines">
      <span /><span /><span /><span />
    </div>
    <div className="reading-highlight">
      <p>The useful signal is often one paragraph deep.</p>
      <span className="reading-highlight__bar" />
    </div>
    <div className="reading-lines reading-lines--short">
      <span /><span />
    </div>
    <div className="reading-score">
      <span>relevance</span>
      <strong>0.91</strong>
    </div>
    <div className="reading-scan" />
  </div>
);

const PaperPreview: React.FC = () => (
  <div className="paper-mock" aria-hidden="true">
    <div className="paper-pane paper-pane--doc">
      <span className="paper-pane__label">Manuscript.docx</span>
      <strong>Attention is all you need</strong>
      <div className="paper-lines">
        <span /><span /><span />
      </div>
      <i>E = mc²</i>
      <span className="paper-meta">12 pages · 3 figures</span>
    </div>
    <div className="paper-arrow">
      <span>OMML</span>
      <ArrowRight size={14} />
    </div>
    <div className="paper-pane paper-pane--tex">
      <span className="paper-pane__label">paper.tex</span>
      <code>{'\\documentclass{IEEEtran}'}</code>
      <code>{'\\begin{document}'}</code>
      <code>{'\\title{Attention...}'}</code>
      <code>{'\\author{...}'}</code>
      <code>{'$E = mc^2$'}</code>
      <code>{'\\end{document}'}</code>
      <span className="paper-build">build passed</span>
    </div>
  </div>
);

const ProjectMedia: React.FC<{ project: Project }> = ({ project }) => {
  if (project.video) {
    return <ProjectVideo src={project.video.src} poster={project.video.poster} />;
  }

  return project.id === 'reading-with-ai' ? <ReadingPreview /> : <PaperPreview />;
};

const ProjectPage: React.FC<{ project: Project; index: number }> = ({ project, index }) => {
  const primaryHref = project.links.live ?? project.links.github;
  const number = String(index + 1).padStart(2, '0');

  return (
    <article
      id={'project-' + project.id}
      className={'project-page' + (index % 2 === 1 ? ' project-page--reverse' : '')}
    >
      <div className="project-page__copy">
        <div className="project-page__top">
          <span className="project-page__number">{number}</span>
          <span className="project-page__category">{project.category}</span>
        </div>

        <h3>
          <a href={primaryHref} target="_blank" rel="noreferrer">
            {project.title}
          </a>
        </h3>
        <p className="project-page__tagline">{project.tagline}</p>
        <p className="project-page__desc">{project.description}</p>

        <div className="project-page__tags">
          {project.tags.map((tag) => (
            <span className="project-tag" key={tag}>{tag}</span>
          ))}
        </div>

        <div className="project-page__foot">
          <span className="status">
            <span className="status-dot" aria-hidden="true" />
            {project.status}
          </span>
          <div className="project-page__links">
            {project.links.live && (
              <a className="card-link" href={project.links.live} target="_blank" rel="noreferrer">
                live <ArrowUpRight size={12} />
              </a>
            )}
            <a className="card-link" href={project.links.github} target="_blank" rel="noreferrer">
              source <ArrowUpRight size={12} />
            </a>
          </div>
        </div>
      </div>

      <figure className="project-page__media">
        <div className={'project-media' + (project.video ? ' project-media--wide' : '') + (project.id === 'career-ops' ? ' project-media--career' : '')}>
          <ProjectMedia project={project} />
        </div>
        <figcaption className="project-media__caption">
          <span>{project.caption}</span>
          <span>{number} / 04</span>
        </figcaption>
      </figure>
    </article>
  );
};

const WorkSection: React.FC = () => (
  <section id="work" className="paper-section work-section work-pages">
    <div className="shell">
      <div className="work-head">
        <SectionEyebrow>selected work</SectionEyebrow>
        <h2 className="display">
          Four systems, shown <strong>close up.</strong>
        </h2>
        <p className="lede">
          Each project gets its own page here: the system, the result, and the part that had to work
          in practice.
        </p>
      </div>

      <nav className="project-index" aria-label="Project index">
        {PROJECTS.map((project, index) => (
          <a key={project.id} href={'#project-' + project.id} className="project-index__item">
            <span className="project-index__number">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="project-index__text">
              <span className="project-index__title">{project.title}</span>
              <span className="project-index__category">{project.category}</span>
            </span>
            <ArrowUpRight size={13} className="project-index__arrow" />
          </a>
        ))}
      </nav>

      <div className="project-pages">
        {PROJECTS.map((project, index) => (
          <ProjectPage key={project.id} project={project} index={index} />
        ))}
      </div>

      <div className="work-foot">
        <a className="btn-dark" href="https://github.com/redfries" target="_blank" rel="noreferrer">
          See all repositories <ArrowUpRight size={15} />
        </a>
      </div>
    </div>
  </section>
);

const ContactSection: React.FC = () => (
  <section id="contact" className="paper-section contact-section">
    <div className="shell">
      <div className="contact-panel">
        <svg
          className="contact-panel__infinity"
          viewBox="0 0 200 100"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M100 50 C 100 50, 150 100, 175 75 C 200 50, 150 0, 100 50 C 50 100, 0 50, 25 25 C 50 0, 100 50, 100 50"
            stroke="currentColor"
            strokeWidth="1"
          />
        </svg>

        <div className="contact-grid">
          <div>
            <SectionEyebrow>contact</SectionEyebrow>
            <h2 className="contact-title">
              Have a hard <strong>problem?</strong>
            </h2>
            <p className="contact-copy">
              Send the workflow, the data, or the step that keeps failing. I&apos;ll tell you what it
              would take to make it dependable.
            </p>
            <a className="btn-dark contact-action" href="mailto:studioinfinitys@gmail.com">
              studioinfinitys@gmail.com <ArrowUpRight size={15} />
            </a>
          </div>

          <div className="contact-aside">
            <p className="micro-label">currently building</p>
            <ul>
              {[
                'Document intelligence for Arabic records',
                'LLM systems with evaluation built in',
                'Agents that leave a record of every step',
              ].map((item, index) => (
                <li key={item}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="footer-grid">
          <p className="footer-statement">
            AI &amp; ML engineer working across <strong>models, systems, and the last mile.</strong>
          </p>

          <div className="footer-cols">
            <div className="footer-col">
              <p className="footer-col__title">index</p>
              <a href="#work">work</a>
              <a href="#approach">approach</a>
              <a href="#contact">contact</a>
              <a href="/rent/">residence rent</a>
            </div>
            <div className="footer-col">
              <p className="footer-col__title">elsewhere</p>
              <a href="https://github.com/redfries" target="_blank" rel="noreferrer">GitHub</a>
              <a href="https://www.linkedin.com/in/redfries/" target="_blank" rel="noreferrer">LinkedIn</a>
              <a href="mailto:studioinfinitys@gmail.com">Email</a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {year} Shabaaz Hussain</span>
          <div className="footer-socials" aria-label="Social links">
            <a href="https://github.com/redfries" target="_blank" rel="noreferrer" aria-label="GitHub">
              <Github size={16} />
            </a>
            <a href="https://www.linkedin.com/in/redfries/" target="_blank" rel="noreferrer" aria-label="LinkedIn">
              <Linkedin size={16} />
            </a>
            <a href="mailto:studioinfinitys@gmail.com" aria-label="Email">
              <Mail size={16} />
            </a>
          </div>
          <a href="#top" className="back-to-top">
            back to top <ArrowUp size={12} />
          </a>
        </div>
      </div>
    </footer>
  );
};

export default function App() {
  const [heroStatus, setHeroStatus] = useState<HeroStatus>('loading');
  const [heroAccent, setHeroAccent] = useState('#a8b8ce');
  const figureRef = useRef<HTMLDivElement>(null);

  return (
    <div id="top" className="app-root">
      {/* The tubes travel with the hero; stars remain fixed above their canvas.
          Both remain at the root, below the z-10 content sections. */}
      <TubesInfinity anchorRef={figureRef} onStatusChange={setHeroStatus} onAccentChange={setHeroAccent} />
      {heroStatus === 'failed' && <ParticleGrid />}
      <Starfield />

      <Header />

      <main>
        <MainHero status={heroStatus} figureRef={figureRef} />
        <PaperTransition ground={heroStatus === 'ready' ? '#000000' : '#171717'} accent={heroAccent} />
        <ApproachSection />
        <ToolkitSection />
        <WorkSection />
        <ContactSection />
      </main>

      <Footer />
    </div>
  );
}
