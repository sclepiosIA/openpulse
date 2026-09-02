import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, Shield, Hospital } from "lucide-react";
import logoMarque from "@/assets/logo_sans_slogan.svg";
import type { DpoStat } from "@/lib/dpo-content";

interface DpoHeroSectionProps {
  etablissement: string;
  stats: DpoStat[];
  onScrollToEngagements?: () => void;
}

export function DpoHeroSection({ etablissement, stats, onScrollToEngagements }: DpoHeroSectionProps) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-marque-white via-marque-pastelCyan/40 to-marque-pastelViolet/20 py-12 md:py-16 lg:py-20">
      {/* Animated background patterns */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-marque-cyan/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-marque-cyan/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/4 right-1/4 w-32 h-32 opacity-5">
          <Shield className="w-full h-full text-marque-blue" />
        </div>
      </div>

      <div className="container relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          {/* Badges */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
            <Badge variant="outline" className="px-4 py-2 text-sm border-marque-blue/30 bg-marque-blue/10 text-marque-blue animate-fade-in font-titillium">
              <Hospital className="h-4 w-4 mr-2" />
              {etablissement}
            </Badge>
            <Badge variant="outline" className="px-4 py-2 text-sm border-marque-cyan bg-marque-cyan/20 text-marque-blue animate-fade-in font-titillium">
              <Shield className="h-4 w-4 mr-2" />
              RGPD & Protection des données
            </Badge>
          </div>

          {/* Main title + logo */}
          <div className="animate-fade-in flex flex-col items-center gap-4">
            <h1 className="font-sofia text-4xl md:text-6xl lg:text-7xl font-bold leading-tight">
              <span className="bg-gradient-to-r from-marque-blue to-marque-blue bg-clip-text text-transparent">
                Vos données Patients
              </span>
            </h1>
            <img loading="lazy" decoding="async" src={logoMarque} alt="OpenPulse" className="h-16 md:h-24 lg:h-28 w-auto" />
          </div>

          {/* Subtitle */}
          <p
            style={{ animationDelay: "200ms" }}
            className="font-titillium text-xl md:text-2xl text-marque-blue max-w-2xl mx-auto animate-fade-in text-center"
          >
            Découvrez comment OpenPulse protège les données de santé de vos patients, en conformité totale avec le RGPD.
          </p>

          {/* CTA */}
          <div className="flex justify-center animate-fade-in" style={{ animationDelay: "400ms" }}>
            <Button
              size="lg"
              className="group gap-2 px-8 bg-marque-orange hover:bg-marque-orange/90 hover:shadow-xl transition-all duration-300 font-titillium"
              onClick={onScrollToEngagements}
            >
              En savoir plus
              <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 animate-fade-in" style={{ animationDelay: "600ms" }}>
            {stats.map((stat) => (
              <div
                key={`dpo-hero-stat-${stat.label}`}
                className="p-6 rounded-xl bg-marque-white/80 backdrop-blur-sm border border-marque-cyan hover:border-marque-blue/40 hover:shadow-lg transition-all duration-300 flex flex-col items-center text-center justify-between h-full"
              >
                <div className="text-2xl md:text-3xl">{stat.icon}</div>
                <div className="font-sofia text-4xl md:text-5xl font-bold text-marque-blue mt-3">{stat.value}</div>
                <div className="font-titillium text-sm md:text-base text-marque-blue flex-1 flex items-end mt-2">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
