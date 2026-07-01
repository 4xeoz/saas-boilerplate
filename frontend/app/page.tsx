'use client';

import { useEffect, useState, useRef } from "react";
import { useUser } from "@/lib/UserContext";
import { getGoogleLoginUrl } from "@/lib/api";
import Link from "next/link";
import Image from "next/image";
import {
  FiArrowRight, FiLogOut, FiCheckCircle,
  FiZap, FiLock, FiTrendingUp, FiLayers, FiUsers,
  FiGlobe, FiCpu, FiBarChart2,
} from "react-icons/fi";

// ── Animated grid background ──────────────────────────────────
function AnimatedGridBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(to right, var(--text-muted) 1px, transparent 1px),
            linear-gradient(to bottom, var(--text-muted) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
      <div
        className="absolute inset-0 animate-grid-spotlight opacity-30"
        style={{
          background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(159,232,112,0.07), transparent 40%)`,
        }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-brand-1/[0.02] blur-3xl" />
    </div>
  );
}

// ── Mouse spotlight ───────────────────────────────────────────
function useMouseSpotlight() {
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
}

// ── Reveal on scroll ──────────────────────────────────────────
function useReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setRevealed(true); observer.disconnect(); } },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, revealed };
}

// ── Staggered reveal ─────────────────────────────────────────
function StaggerReveal({
  children, className = "", staggerDelay = 75, baseDelay = 0,
}: {
  children: React.ReactNode; className?: string; staggerDelay?: number; baseDelay?: number;
}) {
  const { ref, revealed } = useReveal(0.05);
  return (
    <div ref={ref} className={className}>
      {Array.isArray(children)
        ? children.map((child, i) => (
            <div
              key={i}
              className="transition-all duration-700 ease-out"
              style={{
                opacity: revealed ? 1 : 0,
                transform: revealed ? 'translateY(0)' : 'translateY(30px)',
                transitionDelay: `${baseDelay + i * staggerDelay}ms`,
              }}
            >
              {child}
            </div>
          ))
        : children}
    </div>
  );
}

// ── Bento card ───────────────────────────────────────────────
function BentoCard({ icon: Icon, title, description, className = "", span = "" }: {
  icon: React.ElementType; title: string; description: string; className?: string; span?: string;
}) {
  return (
    <div className={`group relative overflow-hidden rounded-3xl border border-border bg-surface p-8 transition-all duration-500 hover:border-brand-1/30 hover:glow-green ${span} ${className}`}>
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-brand-1/5 blur-3xl transition-all duration-500 group-hover:bg-brand-1/10 group-hover:scale-150" />
      <div className="relative">
        <div className="w-11 h-11 rounded-xl bg-brand-1/10 flex items-center justify-center mb-5 group-hover:bg-brand-1/20 transition-colors">
          <Icon className="w-5 h-5 text-brand-1" />
        </div>
        <h3 className="text-lg font-bold text-text-primary mb-2">{title}</h3>
        <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

// ── Floating particle ─────────────────────────────────────────
function FloatingParticle({ size, left, top, delay, duration }: {
  size: number; left: string; top: string; delay: number; duration: number;
}) {
  return (
    <div
      className="absolute rounded-full bg-brand-1/20 pointer-events-none"
      style={{
        width: size, height: size, left, top,
        animation: `floatParticle ${duration}s ease-in-out infinite`,
        animationDelay: `${delay}s`,
      }}
    />
  );
}

// ── Page ──────────────────────────────────────────────────────

type HeroPhase = 'initial' | 'settle' | 'content';

export default function Home() {
  const { user, loading: userLoading, logout } = useUser();
  const ctaHref = user ? "/dashboard" : getGoogleLoginUrl();
  const ctaLabel = user ? "Go to App" : "Get started free";
  const isExternal = !user;

  const [heroPhase, setHeroPhase] = useState<HeroPhase>('initial');
  const [showNav, setShowNav] = useState(false);

  useMouseSpotlight();

  useEffect(() => {
    const timers = [
      setTimeout(() => setHeroPhase('settle'), 1000),
      setTimeout(() => setHeroPhase('content'), 1600),
      setTimeout(() => setShowNav(true), 2000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const { ref: featuresRef, revealed: featuresRevealed } = useReveal();
  const { ref: stepsRef, revealed: stepsRevealed } = useReveal();
  const { ref: ctaRef, revealed: ctaRevealed } = useReveal();

  return (
    <div className="min-h-screen bg-background text-text-primary overflow-x-hidden">
      <AnimatedGridBackground />

      {/* Nav */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${showNav ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
        <div className="glass border-b border-border/50">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative w-7 h-7 rounded-lg overflow-hidden shrink-0 ring-2 ring-brand-1/20 group-hover:ring-brand-1/50 transition-all">
                <Image src="/Tronnium_Main.png" alt="Logo" fill className="object-cover" />
              </div>
              <span className="text-sm font-bold tracking-tight text-text-primary">MyApp</span>
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-text-secondary hover:text-text-primary transition-colors">Features</a>
              <a href="#how" className="text-sm text-text-secondary hover:text-text-primary transition-colors">How it works</a>
            </nav>

            <div className="flex items-center gap-3">
              {userLoading ? (
                <div className="w-5 h-5 border-2 border-brand-1 border-t-transparent rounded-full animate-spin" />
              ) : user ? (
                <>
                  <span className="text-sm text-text-muted hidden sm:block">{user.name}</span>
                  <Link href="/dashboard" className="btn-primary btn-sm">Go to App</Link>
                  <button onClick={logout} className="btn-icon" title="Logout">
                    <FiLogOut className="w-4 h-4 text-text-muted" />
                  </button>
                </>
              ) : (
                <a href={getGoogleLoginUrl()} className="btn-primary btn-sm">Sign in</a>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <FloatingParticle size={4} left="15%" top="20%" delay={0} duration={6} />
          <FloatingParticle size={3} left="75%" top="15%" delay={1.5} duration={8} />
          <FloatingParticle size={5} left="85%" top="60%" delay={0.8} duration={7} />
          <FloatingParticle size={3} left="25%" top="70%" delay={2.2} duration={9} />
          <FloatingParticle size={4} left="50%" top="85%" delay={1} duration={6.5} />
          <FloatingParticle size={2} left="65%" top="35%" delay={3} duration={10} />
          <FloatingParticle size={3} left="10%" top="45%" delay={2} duration={7.5} />
        </div>

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[10%] left-[15%] w-[500px] h-[500px] rounded-full bg-brand-1/8 blur-[120px] animate-pulse-glow" />
          <div className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] rounded-full bg-brand-1/5 blur-[100px] animate-pulse-glow" style={{ animationDelay: "2s" }} />
        </div>

        <div className="relative z-20 flex flex-col items-center">
          <div
            className="relative transition-all will-change-transform"
            style={{
              transitionDuration: heroPhase === 'settle' ? '600ms' : '0ms',
              transitionTimingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              transform: heroPhase === 'initial' ? 'translateY(0px) scale(1)' : 'translateY(-90px) scale(0.72)',
            }}
          >
            <div className="absolute inset-0 rounded-3xl bg-brand-1/30 blur-2xl transition-all duration-700"
              style={{ transform: heroPhase === 'initial' ? 'scale(1.6)' : 'scale(1.2)', opacity: 0.6 }}
            />
            <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-3xl overflow-hidden ring-[3px] ring-brand-1/30 shadow-2xl">
              <Image src="/Tronnium_Main.png" alt="Logo" fill className="object-cover" />
            </div>
          </div>

          <div
            className="relative z-10 text-center max-w-3xl mx-auto px-6 transition-all duration-700"
            style={{
              opacity: heroPhase === 'content' ? 1 : 0,
              transform: heroPhase === 'content' ? 'translateY(0)' : 'translateY(20px)',
              pointerEvents: heroPhase === 'content' ? 'auto' : 'none',
            }}
          >
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full glass mb-8 animate-subtle-bounce">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-1 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-1" />
              </span>
              <span className="text-xs font-semibold text-text-secondary">Now in beta</span>
            </div>

            <h1 className="text-display text-5xl sm:text-6xl md:text-7xl lg:text-[84px] leading-[0.95] tracking-[-0.04em] mb-6">
              Build something
              <br />
              <span className="gradient-text">worth using.</span>
            </h1>

            <p className="text-lg md:text-xl text-text-secondary leading-relaxed mb-10 max-w-xl mx-auto">
              The foundation for your next SaaS. Auth, database, and UI — all wired up and ready to ship.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              {isExternal ? (
                <a href={ctaHref} className="btn-primary btn-lg group animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                  {ctaLabel}
                  <FiArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </a>
              ) : (
                <Link href={ctaHref} className="btn-primary btn-lg group animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                  {ctaLabel}
                  <FiArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Link>
              )}
              <a href="#features" className="btn-secondary btn-lg animate-fade-in-up" style={{ animationDelay: '350ms' }}>See what&apos;s included</a>
            </div>

            <div className="mt-12 flex items-center justify-center gap-6 text-xs text-text-muted animate-fade-in-up" style={{ animationDelay: '500ms' }}>
              <div className="flex items-center gap-2">
                <FiCheckCircle className="w-4 h-4 text-brand-1" />
                <span>Google OAuth ready</span>
              </div>
              <div className="flex items-center gap-2">
                <FiCheckCircle className="w-4 h-4 text-brand-1" />
                <span>Prisma + PostgreSQL</span>
              </div>
              <div className="flex items-center gap-2">
                <FiCheckCircle className="w-4 h-4 text-brand-1" />
                <span>Next.js + Express</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features bento */}
      <section id="features" className="py-24 md:py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div ref={featuresRef} className={`text-center mb-16 transition-all duration-700 ${featuresRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-1 mb-4">What&apos;s included</p>
            <h2 className="text-display text-4xl md:text-5xl lg:text-6xl tracking-tight">
              <span className="gradient-text">Everything you need.</span>
            </h2>
          </div>

          <StaggerReveal className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-[180px]" staggerDelay={80}>
            <BentoCard icon={FiLock} title="Authentication" description="Google OAuth 2.0 with JWT cookies. Sign in, sign out, and user profiles — all wired up." span="md:col-span-2" className="md:row-span-2 flex flex-col justify-end" />
            <BentoCard icon={FiCpu} title="Prisma ORM" description="Type-safe database access with auto-generated client and easy migrations." className="md:row-span-2 flex flex-col justify-end" />
            <BentoCard icon={FiLayers} title="Monorepo" description="Frontend and backend in one repo with shared types and a unified dev workflow." />
            <BentoCard icon={FiZap} title="Fast by default" description="Next.js 16, React 19, TailwindCSS 4, and React Query — the modern SaaS stack." span="md:col-span-2" />
            <BentoCard icon={FiUsers} title="User model" description="UserAccount with Google identity linking, roles, and profile data out of the box." className="md:row-span-2 flex flex-col justify-end" />
            <BentoCard icon={FiBarChart2} title="UI system" description="Design tokens, dark/light theme, reusable components — your design language, ready." />
            <BentoCard icon={FiTrendingUp} title="API structure" description="Express routes, response helpers, and JWT guard middleware. Add your own endpoints fast." span="md:col-span-2" className="md:row-span-2 flex flex-col justify-end" />
            <BentoCard icon={FiGlobe} title="Deploy anywhere" description="Standard Node.js backend and Next.js frontend. Works on any cloud or VPS." />
          </StaggerReveal>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 md:py-32 bg-surface-secondary/30 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-brand-1/5 blur-[120px] animate-pulse-glow" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative">
          <div ref={stepsRef} className={`text-center mb-20 transition-all duration-700 ${stepsRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-1 mb-4">How to use</p>
            <h2 className="text-display text-4xl md:text-5xl lg:text-6xl tracking-tight">
              <span className="gradient-text">Start in minutes.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-16 left-[16.67%] right-[16.67%] h-px">
              <div className="h-full bg-gradient-to-r from-transparent via-brand-1/30 to-transparent animate-pulse-glow" />
            </div>

            {[
              { num: "01", icon: FiLock, title: "Clone & configure", body: "Clone the repo, add your Google OAuth credentials and database URL to .env, and you're set." },
              { num: "02", icon: FiCpu, title: "Run migrations", body: "Run prisma migrate dev to set up your database. Add your own models alongside the User." },
              { num: "03", icon: FiZap, title: "Ship your product", body: "Add your pages, API routes, and business logic. The boilerplate stays out of your way." },
            ].map((step, i) => (
              <div
                key={step.num}
                className={`relative group transition-all duration-700 ${stepsRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                style={{ transitionDelay: `${200 + i * 150}ms` }}
              >
                <div className="glass rounded-3xl p-8 h-full transition-all duration-500 hover:glow-green border border-border/50 hover:-translate-y-1">
                  <div className="w-14 h-14 rounded-2xl bg-brand-1/10 flex items-center justify-center mb-6 group-hover:bg-brand-1/20 transition-colors group-hover:scale-110 duration-300">
                    <step.icon className="w-6 h-6 text-brand-1" />
                  </div>
                  <div className="text-5xl font-black text-brand-1/10 mb-4 leading-none">{step.num}</div>
                  <h3 className="text-xl font-bold text-text-primary mb-3">{step.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{step.body}</p>
                </div>
                <div className="hidden md:flex absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-brand-1 opacity-20 animate-ping" style={{ animationDelay: `${i * 0.5}s` }} />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        <div ref={ctaRef} className={`max-w-7xl mx-auto px-6 transition-all duration-700 ${ctaRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className={`relative rounded-[32px] overflow-hidden transition-all duration-1000 delay-200 ${ctaRevealed ? 'scale-100' : 'scale-[0.95]'}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-brand-2 via-[#1a3a00] to-brand-2 animate-gradient-shift" />
            <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-brand-1/20 blur-[100px] animate-pulse-glow" />
            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-brand-1/10 blur-[80px] animate-pulse-glow" style={{ animationDelay: '1.5s' }} />

            <div className="relative px-8 py-20 md:px-16 md:py-24 text-center">
              <h2 className="text-display text-3xl md:text-5xl lg:text-6xl text-brand-1 tracking-tight mb-4">
                Stop rebuilding the basics.
              </h2>
              <p className="text-brand-1/60 text-base md:text-lg mb-10 max-w-md mx-auto">
                Fork it, rename it, and ship your idea. The boilerplate handles everything else.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                {isExternal ? (
                  <a href={ctaHref} className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-brand-1 text-brand-2 font-bold text-base btn-wise group glow-green hover:scale-105 transition-transform duration-300">
                    {ctaLabel}
                    <FiArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </a>
                ) : (
                  <Link href={ctaHref} className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-brand-1 text-brand-2 font-bold text-base btn-wise group glow-green hover:scale-105 transition-transform duration-300">
                    {ctaLabel}
                    <FiArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                )}
                <a href="#features" className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-brand-1/30 text-brand-1 font-semibold text-base hover:bg-brand-1/10 transition-colors hover:scale-105 duration-300">
                  See what&apos;s included
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="relative w-6 h-6 rounded-full overflow-hidden">
                <Image src="/Tronnium_Main.png" alt="Logo" fill className="object-cover" />
              </div>
              <span className="text-sm font-bold text-text-primary">MyApp</span>
            </Link>
            <p className="text-xs text-text-muted">© {new Date().getFullYear()} MyApp. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-xs text-text-muted hover:text-text-primary transition-colors">Privacy</a>
              <a href="#" className="text-xs text-text-muted hover:text-text-primary transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
