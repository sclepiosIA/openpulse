/**
 * @fileoverview Hook d'authentification centralisé pour OpenPulse.
 * 
 * Ce module ré-exporte le hook useAuth depuis AuthProvider pour garantir
 * que tous les composants utilisent le même contexte d'authentification.
 * 
 * @module hooks/useAuth
 * 
 * @example
 * ```tsx
 * import { useAuth } from '@/hooks/shared/useAuth';
 * 
 * function ProfileButton() {
 *   const { user, loading, signOut } = useAuth();
 *   
 *   if (loading) return <Spinner />;
 *   if (!user) return <LoginButton />;
 *   
 *   return (
 *     <button onClick={signOut}>
 *       Déconnexion ({user.email})
 *     </button>
 *   );
 * }
 * ```
 * 
 * @returns {Object} Contexte d'authentification
 * @property {User | null} user - Utilisateur Supabase connecté
 * @property {Session | null} session - Session Supabase active
 * @property {boolean} loading - État de chargement initial
 * @property {function} signIn - Fonction de connexion (email, password)
 * @property {function} signUp - Fonction d'inscription (email, password, userData)
 * @property {function} signOut - Fonction de déconnexion
 * 
 * @see {@link AuthProvider} pour l'implémentation complète
 * @see {@link docs/AUTH_TECH_GUIDE.md} pour la documentation technique
 */

// Re-export from AuthProvider for backwards compatibility
// This ensures all components use the same auth context
export { useAuth } from '@/components/AuthProvider';
