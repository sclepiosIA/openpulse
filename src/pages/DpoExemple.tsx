import { useState } from "react";
import { ScrollProgress } from "@/components/formations/ScrollProgress";
import { useIntersectionObserver } from "@/hooks/shared/useIntersectionObserver";
import { dpoConfigExemple } from "@/lib/dpo-content";
import {
  DpoHeroSection,
  DpoNavigationScrollSpy,
  DpoEngagementsSection,
  DpoHebergementSection,
  DpoSecuriteSection,
  DpoTraitementsSection,
  DpoDroitsSection,
  DpoContactSection,
} from "@/components/dpo";

const config = dpoConfigExemple;

export default function DpoExemple() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const engagementsRef = useIntersectionObserver({ threshold: 0.1, triggerOnce: true });
  const hebergementRef = useIntersectionObserver({ threshold: 0.1, triggerOnce: true });
  const securiteRef = useIntersectionObserver({ threshold: 0.1, triggerOnce: true });
  const traitementsRef = useIntersectionObserver({ threshold: 0.1, triggerOnce: true });
  const droitsRef = useIntersectionObserver({ threshold: 0.1, triggerOnce: true });
  const contactRef = useIntersectionObserver({ threshold: 0.1, triggerOnce: true });

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: elementPosition - offset, behavior: "smooth" });
    }
  };

  return (
    <div className={`min-h-dvh bg-marque-pastelCyan/50 transition-[padding] duration-400 ${sidebarOpen ? "lg:pl-64" : ""}`}>
      <ScrollProgress />
      <DpoNavigationScrollSpy onDesktopVisibilityChange={setSidebarOpen} />

      <DpoHeroSection
        etablissement={config.etablissement}
        stats={config.stats}
        onScrollToEngagements={() => scrollToSection("engagements")}
      />

      <div className="container max-w-7xl mx-auto px-4 py-16 space-y-16 md:space-y-20">
        {/* Engagements */}
        <section
          id="engagements"
          ref={engagementsRef.ref}
          className={`scroll-mt-24 transition-all duration-1000 ${engagementsRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <DpoEngagementsSection engagements={config.engagements} />
        </section>

        {/* Hébergement */}
        <section
          id="hebergement"
          ref={hebergementRef.ref}
          className={`scroll-mt-24 transition-all duration-1000 ${hebergementRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <DpoHebergementSection items={config.hebergement} />
        </section>

        {/* Sécurité */}
        <section
          id="securite"
          ref={securiteRef.ref}
          className={`scroll-mt-24 transition-all duration-1000 ${securiteRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <DpoSecuriteSection items={config.securite} />
        </section>

        {/* Traitements */}
        <section
          id="traitements"
          ref={traitementsRef.ref}
          className={`scroll-mt-24 transition-all duration-1000 ${traitementsRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <DpoTraitementsSection traitements={config.traitements} />
        </section>

        {/* Droits */}
        <section
          id="droits"
          ref={droitsRef.ref}
          className={`scroll-mt-24 transition-all duration-1000 ${droitsRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <DpoDroitsSection droits={config.droits} />
        </section>

        {/* Contact & FAQ */}
        <section
          id="contact"
          ref={contactRef.ref}
          className={`scroll-mt-24 transition-all duration-1000 ${contactRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <DpoContactSection contactDpo={config.contactDpo} faq={config.faq} />
        </section>
      </div>
    </div>
  );
}
