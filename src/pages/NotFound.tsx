import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { debug } from "@/lib/debug";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    debug.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground">404</h1>
        <p className="text-xl text-muted-foreground mb-4">Oups ! Page introuvable</p>
        <a href="/" className="text-primary hover:text-primary/80 underline">
          Retour à l'accueil
        </a>
      </div>
    </div>
  );
};

export default NotFound;
