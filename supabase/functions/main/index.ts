/**
 * Service d'entrée du moteur d'exécution des fonctions de bord.
 *
 * POURQUOI CE FICHIER EXISTE
 * Le moteur démarre avec `--main-service /home/deno/functions` et attend à cet
 * endroit un service nommé `main` : c'est lui qui reçoit chaque requête et
 * décide quelle fonction l'exécute. Sans ce fichier, le conteneur sort au
 * démarrage sur « failed to read path — No such file or directory », sans
 * nommer le chemin manquant, et redémarre en boucle.
 *
 * Les 272 fonctions du dépôt vivent dans des répertoires voisins ; ce service
 * se contente de les router, à partir du premier segment du chemin d'URL.
 */

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const nom = url.pathname.replace(/^\/+/, '').split('/')[0]

  // Sonde de vie : le conteneur doit pouvoir répondre sans qu'aucune fonction
  // ne soit appelée, sinon toute surveillance le croit mort.
  if (!nom || nom === 'healthz') {
    return new Response(JSON.stringify({ etat: 'ok' }), {
      headers: { 'content-type': 'application/json' },
    })
  }

  // Les répertoires techniques ne sont pas des fonctions appelables : les
  // exposer permettrait d'invoquer du code partagé hors de son contexte.
  if (nom.startsWith('_') || nom === 'main') {
    return new Response(JSON.stringify({ error: 'fonction inconnue' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    })
  }

  const chemin = `/home/deno/functions/${nom}`

  // POURQUOI IL FAUT DESIGNER LA CARTE D'IMPORTS ICI.
  // Les fonctions importent `@supabase/supabase-js`, `zod`, `hono` et
  // `mcp-lite` par leur nom. Ces noms n'existent que dans
  // `supabase/functions/deno.json`. Un worker cree sans carte ne les resout
  // pas et sort sur « Relative import path "@supabase/supabase-js" not
  // prefixed with / or ./ or ../ » -- ce qui rendait AUCUNE fonction
  // appelable, la panne remontant en HTTP 500 generique.
  const carteImports = '/home/deno/functions/deno.json'

  try {
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath: chemin,
      importMapPath: carteImports,
      memoryLimitMb: 256,
      workerTimeoutMs: 5 * 60 * 1000,
      noModuleCache: false,
      envVars: Object.entries(Deno.env.toObject()),
    })
    return await worker.fetch(req)
  } catch (e) {
    // Une fonction absente est une erreur du client, pas du serveur : on
    // distingue les deux, sans quoi toute faute de frappe ressemble à une panne.
    const message = e instanceof Error ? e.message : String(e)
    const introuvable = message.includes('No such file') || message.includes('not found')
    return new Response(
      JSON.stringify({ error: introuvable ? 'fonction inconnue' : "erreur d'exécution" }),
      { status: introuvable ? 404 : 500, headers: { 'content-type': 'application/json' } }
    )
  }
})
