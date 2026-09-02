import { useShouldAnimate } from "@/hooks/ui/useShouldAnimate";

// Ces halos etaient bleus (hsl 200, 220) et violet (hsl 250) : la palette
// precedente. Ils sont repris sur les deux couleurs chaudes de la charte --
// l'accent (22 78% 45%) et la teinte douce (22 71% 85%) -- ce qui reveille le
// fond encre au lieu de le grisailler.
const floatingElements = [
  { size: 80, x: "10%", y: "20%", duration: 6, delay: 0, color: "hsl(22 78% 45% / 0.16)" },
  { size: 120, x: "80%", y: "15%", duration: 8, delay: 1, color: "hsl(22 71% 85% / 0.10)" },
  { size: 60, x: "70%", y: "60%", duration: 7, delay: 2, color: "hsl(22 78% 45% / 0.12)" },
  { size: 100, x: "20%", y: "70%", duration: 9, delay: 0.5, color: "hsl(26 39% 97% / 0.08)" },
  { size: 40, x: "50%", y: "30%", duration: 5, delay: 1.5, color: "hsl(22 78% 45% / 0.20)" },
  { size: 70, x: "85%", y: "75%", duration: 10, delay: 3, color: "hsl(22 71% 85% / 0.12)" },
];

export function FloatingElements() {
  const shouldAnimate = useShouldAnimate();

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Floating orbs */}
      {floatingElements.map((element) => (
        <div
          key={`${element.x}-${element.y}`}
          className={`absolute rounded-full blur-xl ${shouldAnimate ? 'animate-auth-float' : ''}`}
          style={{
            width: element.size,
            height: element.size,
            left: element.x,
            top: element.y,
            backgroundColor: element.color,
            animationDuration: `${element.duration}s`,
            animationDelay: `${element.delay}s`,
          }}
        />
      ))}

      {/* Geometric shapes */}
      {/*
        Ce carre etait pose a 15 % du bord gauche, c'est-a-dire en plein dans
        la colonne de texte : il traversait « Securite maximale ». Invisible
        tant que sa bordure etait a peine plus claire que le fond, le defaut
        est apparu des que la charte a rechauffe les couleurs. Il passe a
        droite, dans la zone que le texte n'occupe jamais.
      */}
      <div
        className="absolute w-32 h-32 border-2 border-marque-douce/12 rounded-2xl"
        style={{ right: "8%", top: "16%", transform: "rotate(15deg)" }}
      />
      <div
        className="absolute w-20 h-20 border border-marque-douce/12 rounded-full"
        style={{ right: "25%", top: "45%" }}
      />

      {/* Dots pattern */}
      <div
        className={`absolute grid grid-cols-4 gap-4 ${shouldAnimate ? 'animate-auth-fade-in [animation-delay:1500ms]' : ''}`}
        style={{ left: "4%", bottom: "12%" }}
      >
        {[...Array(16)].map((_, i) => (
          <div
            key={`floating-element-dot-${i}`}
            className="w-1.5 h-1.5 rounded-full bg-marque-douce/35"
          />
        ))}
      </div>
    </div>
  );
}
