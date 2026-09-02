//! Fait dependre la compilation des variables lues par `option_env!`.
//!
//! POURQUOI CE FICHIER EXISTE
//! `config.rs` fige les URL de l'instance a la compilation, via `option_env!`.
//! Or Cargo ne surveille PAS les variables d'environnement employees ainsi : il
//! ne connait que celles qu'un script de construction lui declare. Sans ce
//! fichier, reconstruire avec une autre valeur reutiliserait l'artefact en
//! cache, et le paquet livre porterait l'URL du build precedent — sans erreur,
//! sans avertissement, et sans moyen de s'en apercevoir avant l'installation
//! chez l'utilisateur.
//!
//! Les deux lignes ci-dessous suffisent a rendre ce silence impossible.

fn main() {
    println!("cargo:rerun-if-env-changed=OPENPULSE_WEB_BASE_URL");
    println!("cargo:rerun-if-env-changed=OPENPULSE_API_BASE_URL");
}
