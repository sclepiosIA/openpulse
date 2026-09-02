//! Hachage SHA-256 des fichiers locaux (streaming, buffer 64 Ko).
//!
//! Utilisé par le scanner (détection de modification) et le push worker
//! (empreinte envoyée à `upload-intent` / `upload-complete`).

use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::Read;
use std::path::Path;

use crate::Result;

/// Encode un digest en hexadécimal minuscule.
fn to_hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        use std::fmt::Write;
        let _ = write!(s, "{b:02x}");
    }
    s
}

/// SHA-256 d'un buffer en mémoire (hex minuscule).
pub fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    to_hex(&hasher.finalize())
}

/// SHA-256 d'un fichier en streaming. Retourne `(hex, taille_octets)`.
pub fn sha256_file(path: &Path) -> Result<(String, u64)> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 64 * 1024];
    let mut total: u64 = 0;
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
        total += n as u64;
    }
    Ok((to_hex(&hasher.finalize()), total))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn sha256_known_vectors() {
        // Vecteurs de référence NIST/FIPS 180-4.
        assert_eq!(
            sha256_hex(b""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn sha256_file_matches_buffer() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("doc.txt");
        std::fs::write(&path, b"contenu de test gestion drive").unwrap();

        let (hex, size) = sha256_file(&path).unwrap();
        assert_eq!(size, "contenu de test gestion drive".len() as u64);
        assert_eq!(hex, sha256_hex(b"contenu de test gestion drive"));
    }
}
