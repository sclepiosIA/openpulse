import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface NonMedicalDeviceBannerProps {
  /** Variante visuelle. `compact` = bandeau fin pour pied de page / inline. */
  variant?: "default" | "compact";
  className?: string;
}

/**
 * Bandeau de conformité réglementaire — affirme que OpenPulse n'est pas
 * un dispositif médical au sens du Règlement (UE) 2017/745 (MDR).
 *
 * À insérer sur toutes les pages de formation, la knowledge base et tout
 * support exposant les fonctionnalités IA aux professionnels de santé.
 *
 * Cf. rapport de qualification réglementaire (Patricia Gruffaz, juin 2026) :
 * la destination d'usage de OpenPulse est exclusivement documentaire,
 * administrative et de valorisation PMSI.
 */
export function NonMedicalDeviceBanner({
  variant = "default",
  className,
}: NonMedicalDeviceBannerProps) {
  const isCompact = variant === "compact";

  return (
    <aside
      role="note"
      aria-label="Statut réglementaire OpenPulse"
      className={cn(
        "rounded-xl border border-blue-200 bg-blue-50/80 dark:bg-blue-950/30 dark:border-blue-900",
        "flex gap-3 items-start",
        isCompact ? "p-3 text-xs" : "p-4 md:p-5 text-sm",
        className,
      )}
    >
      <Info
        className={cn(
          "shrink-0 text-blue-600 dark:text-blue-400 mt-0.5",
          isCompact ? "h-4 w-4" : "h-5 w-5",
        )}
        aria-hidden="true"
      />
      <div className="space-y-1 leading-relaxed text-blue-900 dark:text-blue-100">
        <p className="font-semibold">
          OpenPulse n'est pas un dispositif médical
          <span className="font-normal"> au sens du Règlement (UE) 2017/745 (MDR).</span>
        </p>
        <p className="text-blue-900/90 dark:text-blue-100/90">
          Sa destination d'usage est exclusivement{" "}
          <strong>documentaire, administrative et de valorisation</strong>{" "}
          (complétude, traçabilité et structuration des dossiers à des fins
          PMSI / T2A). L'outil n'établit, ne modifie ni n'influence aucun
          diagnostic, traitement ou surveillance de paramètres physiologiques.
          Le professionnel de santé conserve l'entière responsabilité de ses
          décisions cliniques.
        </p>
      </div>
    </aside>
  );
}

export default NonMedicalDeviceBanner;
