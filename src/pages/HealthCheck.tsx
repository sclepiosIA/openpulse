export default function HealthCheck() {
  return (
    <div className="p-8 text-center">
      <h1 className="text-2xl font-bold text-green-600">OK – UI rendue</h1>
      <p className="text-sm text-muted-foreground mt-2">
        React fonctionne, router actif, rendu OK
      </p>
      <div className="mt-4 text-xs font-mono">
        <p>Timestamp: {new Date().toISOString()}</p>
        <p>Route: {window.location.pathname}</p>
      </div>
    </div>
  );
}