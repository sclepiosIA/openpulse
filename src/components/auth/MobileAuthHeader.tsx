import logo from '@/assets/marque/logo-sombre.svg'
import { useMarque } from '@/config/FournisseurMarque'

export function MobileAuthHeader() {
  const marque = useMarque()

  return (
    <header className="flex flex-col items-center bg-[var(--h-openpulse)] px-6 py-7 lg:hidden">
      <img
        src={logo}
        alt={marque.nomProduit}
        width={430}
        height={100}
        decoding="async"
        loading="eager"
        className="h-10 w-auto"
      />
      <p className="mt-3 text-xs font-medium tracking-wide text-marque-douce/65">
        Plateforme de gestion intelligente
      </p>
    </header>
  )
}
