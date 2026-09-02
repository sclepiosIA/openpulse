import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/shared/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { debug } from '@/lib/debug';
import { useInfraUrls } from '@/hooks/shared/useAppConfig';

type ResetStep = 'checking' | 'verify-click' | 'set-password' | 'invalid';

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { cdn_url } = useInfraUrls();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<ResetStep>('checking');
  const [tokenHash, setTokenHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Fonction de vérification du token via verifyOtp (appelée sur action utilisateur)
  const verifyToken = useCallback(async (hash: string) => {
    setIsLoading(true);
    debug.log('[ResetPassword] Verifying token_hash via verifyOtp');

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: hash,
        type: 'recovery',
      });

      if (error) {
        debug.error('[ResetPassword] verifyOtp error:', error);
        
        // Message amélioré selon le type d'erreur
        if (error.message.includes('expired') || error.message.includes('invalid')) {
          setErrorMessage(
            "Ce lien a expiré ou a été pré-ouvert par votre client mail (antivirus, Safe Links...).\n\nDemandez un nouveau lien et cliquez-le rapidement."
          );
        } else {
          setErrorMessage(error.message);
        }
        setStep('invalid');
        return;
      }

      if (data?.session) {
        debug.log('[ResetPassword] Session established via verifyOtp');
        
        // Nettoyer l'URL pour éviter que le token soit reconsommé si refresh
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
        
        setStep('set-password');
      } else {
        setErrorMessage("Impossible d'établir la session. Demandez un nouveau lien.");
        setStep('invalid');
      }
    } catch (err: unknown) {
      debug.error('[ResetPassword] verifyOtp exception:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erreur inattendue';
      setErrorMessage(errorMessage);
      setStep('invalid');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const searchParams = new URLSearchParams(window.location.search);

    // Détection des erreurs explicites dans l'URL
    const errorCode = hashParams.get('error_code') || searchParams.get('error_code');
    const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');

    // Only log non-sensitive error codes in development
    debug.log('[ResetPassword] Init:', { errorCode: errorCode || 'none' });

    // Erreur explicite fournie par Supabase dans l'URL
    if (errorCode) {
      const message = errorCode === 'otp_expired' 
        ? "Le lien de réinitialisation a expiré. Demandez-en un nouveau."
        : errorDescription || "Le lien n'est plus valide.";
      
      toast({
        title: errorCode === 'otp_expired' ? 'Lien expiré' : 'Erreur',
        description: message,
        variant: 'destructive',
      });
      setErrorMessage(message);
      setStep('invalid');
      return;
    }

    // Nouveau flow: token_hash dans query params (anti-prefetch)
    const tokenHashParam = searchParams.get('token_hash');
    const typeParam = searchParams.get('type');

    if (tokenHashParam && typeParam === 'recovery') {
      debug.log('[ResetPassword] token_hash flow detected - waiting for user click');
      setTokenHash(tokenHashParam);
      setStep('verify-click');
      return;
    }

    // Ancien flow: access_token dans hash (auto-session via Supabase)
    const hasAccessToken = hashParams.has('access_token') || searchParams.has('access_token');
    const tokenType = hashParams.get('type') || searchParams.get('type');
    const hasRecoveryParams = hasAccessToken || tokenType === 'recovery' || window.location.hash.includes('recovery');

    if (!hasRecoveryParams) {
      // Pas de paramètres recovery du tout
      setErrorMessage("Aucun lien de réinitialisation détecté.");
      setStep('invalid');
      return;
    }

    // Flow avec access_token: attendre que Supabase établisse la session
    const start = Date.now();
    const TIMEOUT_MS = 15000; // 15 secondes de timeout (augmenté)

    const resolveIfSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      debug.log('[ResetPassword] getSession:', { hasSession: !!session });
      if (!cancelled && session) {
        setStep('set-password');
        return true;
      }
      return false;
    };

    // Listener pour événements auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      debug.log('[ResetPassword] Auth event:', event);
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        setStep('set-password');
      }
    });

    // Check immédiat
    void resolveIfSession();

    // Polling avec timeout plus long
    const intervalId = window.setInterval(async () => {
      if (cancelled) return;
      const done = await resolveIfSession();
      if (done) {
        window.clearInterval(intervalId);
        return;
      }

      if (Date.now() - start > TIMEOUT_MS) {
        window.clearInterval(intervalId);
        if (!cancelled) {
          setErrorMessage(
            "Le lien a probablement été pré-ouvert par votre client mail (antivirus, Safe Links...).\n\nDemandez un nouveau lien et cliquez-le rapidement."
          );
          toast({
            title: 'Lien expiré ou invalide',
            description: "Ce lien n'est plus valide. Demandez-en un nouveau.",
            variant: 'destructive',
          });
          setStep('invalid');
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      subscription.unsubscribe();
    };
  }, [toast]);

  const handleVerifyClick = async () => {
    if (tokenHash) {
      await verifyToken(tokenHash);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas",
        variant: "destructive"
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 6 caractères",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      toast({
        title: "✅ Mot de passe modifié",
        description: "Vous allez être redirigé vers la page de connexion"
      });

      await supabase.auth.signOut();
      navigate('/auth');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Impossible de réinitialiser le mot de passe";
      debug.error('[ResetPassword] Password update error:', error);
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Écran de chargement initial
  if (step === 'checking') {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Vérification du lien...</p>
      </div>
    );
  }

  // Écran d'activation du lien (nouveau flow anti-prefetch)
  if (step === 'verify-click') {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <ShieldCheck className="h-16 w-16 text-primary" />
            </div>
            <CardTitle className="text-2xl text-center">
              Activer le lien
            </CardTitle>
            <CardDescription className="text-center space-y-2">
              <span className="block">
                Cliquez sur le bouton ci-dessous pour activer votre lien de réinitialisation.
              </span>
              <span className="text-xs text-muted-foreground block">
                (Cette étape empêche les antivirus de "brûler" votre lien)
              </span>
              <span className="text-xs text-warning font-medium block mt-2">
                ⚠️ Ne recliquez pas le lien dans l'email après cette étape
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={handleVerifyClick}
              className="w-full"
              disabled={isLoading}
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Vérification...
                </>
              ) : (
                'Continuer'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Écran d'erreur / lien invalide
  if (step === 'invalid') {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <AlertTriangle className="h-16 w-16 text-destructive" />
            </div>
            <CardTitle className="text-2xl text-center text-destructive">
              Lien invalide ou expiré
            </CardTitle>
            <CardDescription className="text-center whitespace-pre-line">
              {errorMessage || "Ce lien de réinitialisation n'est plus valide (expiration après 1 heure)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={() => navigate('/auth')}
              className="w-full"
            >
              Retour à la connexion
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Demandez un nouveau lien depuis "Mot de passe oublié".
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Formulaire de changement de mot de passe
  return (
    <div className="flex items-center justify-center min-h-dvh bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <img 
              src={`${cdn_url}/logos/marque-ia/v2/icons/1.png`} 
              alt="OpenPulse" 
              className="h-16 w-16"
            />
          </div>
          <CardTitle className="text-2xl text-center">
            Nouveau mot de passe
          </CardTitle>
          <CardDescription className="text-center">
            Choisissez un mot de passe sécurisé (min. 6 caractères)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Nouveau mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Confirmer le mot de passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Réinitialisation...
                </>
              ) : (
                'Valider'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
