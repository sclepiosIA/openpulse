import { useShouldAnimate } from "@/hooks/ui/useShouldAnimate";

// Les trois vagues etaient peintes en bleu-gris (hsl 200 et 220), heritage de
// la charte precedente. Posees sur le fond encre de la charte actuelle, elles
// donnaient des trainees froides et grises : le panneau paraissait noir et
// eteint. Elles reprennent les tons chauds de la charte -- douce, papier, puis
// une touche d'accent -- a faible opacite, pour marquer le relief sans
// concurrencer le texte.

export function WaveBackground() {
  const shouldAnimate = useShouldAnimate();

  const staticPath1 = "M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z";
  const staticPath2 = "M0,256L48,240C96,224,192,192,288,181.3C384,171,480,181,576,186.7C672,192,768,192,864,208C960,224,1056,256,1152,261.3C1248,267,1344,245,1392,234.7L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z";
  const staticPath3 = "M0,288L48,272C96,256,192,224,288,218.7C384,213,480,235,576,245.3C672,256,768,256,864,245.3C960,235,1056,213,1152,208C1248,203,1344,213,1392,218.7L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z";

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Wave Layer 1 */}
      <svg
        className={`absolute bottom-0 left-0 w-full h-[40%] ${shouldAnimate ? 'animate-auth-wave-fade-in' : ''}`}
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
      >
        <path d={staticPath1} fill="hsl(22 71% 85% / 0.10)" />
      </svg>

      {/* Wave Layer 2 */}
      <svg
        className={`absolute bottom-0 left-0 w-full h-[35%] ${shouldAnimate ? 'animate-auth-wave-fade-in [animation-delay:200ms]' : ''}`}
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
      >
        <path d={staticPath2} fill="hsl(26 39% 97% / 0.07)" />
      </svg>

      {/* Wave Layer 3 */}
      <svg
        className={`absolute bottom-0 left-0 w-full h-[25%] ${shouldAnimate ? 'animate-auth-wave-fade-in [animation-delay:400ms]' : ''}`}
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
      >
        <path d={staticPath3} fill="hsl(22 78% 45% / 0.14)" />
      </svg>
    </div>
  );
}
