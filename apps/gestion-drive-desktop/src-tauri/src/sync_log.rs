//! Journal de synchronisation simple et exportable.
//!
//! Ring buffer en mémoire (bornes fixes, pas de croissance illimitée) +
//! export vers un fichier texte lisible dans le répertoire de données app.
//! Volontairement minimal (lot 1) : pas de rotation disque, pas de niveaux
//! configurables — juste assez pour diagnostiquer un cycle de sync chez un
//! utilisateur et joindre le fichier à un ticket support.

use serde::Serialize;
use std::collections::VecDeque;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

use crate::AppState;

/// Taille max du journal en mémoire (au-delà : on jette les plus anciens).
pub const MAX_ENTRIES: usize = 2000;

/// Supprime toute query string d'URL avant stockage ou affichage d'un diagnostic.
/// Les URL SAS Azure portent leurs credentials dans la query string.
pub fn sanitize_diagnostic(message: &str) -> String {
    message
        .split_inclusive(char::is_whitespace)
        .map(|segment| {
            let Some(query_start) = segment.find('?') else {
                return segment.to_string();
            };
            if !segment[..query_start].contains("://") {
                return segment.to_string();
            }
            let query = &segment[query_start + 1..];
            let suffix_start = query
                .find(|c: char| {
                    c.is_whitespace() || matches!(c, ')' | ']' | '}' | '>' | '"' | '\'' | ',' | ';')
                })
                .unwrap_or(query.len());
            format!(
                "{}?[redacted]{}",
                &segment[..query_start],
                &query[suffix_start..]
            )
        })
        .collect()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum LogLevel {
    Info,
    Warn,
    Error,
}

impl LogLevel {
    fn as_str(&self) -> &'static str {
        match self {
            LogLevel::Info => "INFO",
            LogLevel::Warn => "WARN",
            LogLevel::Error => "ERROR",
        }
    }
}

/// Une ligne de journal (sérialisée telle quelle vers l'UI).
#[derive(Debug, Clone, Serialize)]
pub struct LogEntry {
    /// Epoch secondes UTC.
    pub ts: i64,
    pub level: LogLevel,
    /// Domaine : "pull" | "push" | "system".
    pub scope: String,
    pub message: String,
}

impl LogEntry {
    /// Ligne texte exportée : `2026-07-07T18:00:00Z [INFO] [pull] message`.
    pub fn to_line(&self) -> String {
        let iso = chrono::DateTime::from_timestamp(self.ts, 0)
            .map(|d| d.format("%Y-%m-%dT%H:%M:%SZ").to_string())
            .unwrap_or_else(|| self.ts.to_string());
        format!(
            "{iso} [{}] [{}] {}",
            self.level.as_str(),
            self.scope,
            self.message
        )
    }
}

/// État partagé du journal (détenu par `AppState`).
#[derive(Debug, Default)]
pub struct SyncLogState {
    entries: Mutex<VecDeque<LogEntry>>,
}

impl SyncLogState {
    pub fn push(&self, level: LogLevel, scope: &str, message: impl Into<String>) {
        let message = message.into();
        let entry = LogEntry {
            ts: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0),
            level,
            scope: scope.to_string(),
            message: sanitize_diagnostic(&message),
        };
        if let Ok(mut q) = self.entries.lock() {
            if q.len() >= MAX_ENTRIES {
                q.pop_front();
            }
            q.push_back(entry);
        }
    }

    pub fn snapshot(&self, limit: usize) -> Vec<LogEntry> {
        match self.entries.lock() {
            Ok(q) => q.iter().rev().take(limit).cloned().collect::<Vec<_>>(),
            Err(_) => Vec::new(),
        }
    }

    /// Toutes les lignes, ordre chronologique (pour l'export).
    pub fn all_lines(&self) -> Vec<String> {
        match self.entries.lock() {
            Ok(q) => q.iter().map(LogEntry::to_line).collect(),
            Err(_) => Vec::new(),
        }
    }

    pub fn clear(&self) {
        if let Ok(mut q) = self.entries.lock() {
            q.clear();
        }
    }
}

/// Helpers d'appel depuis les moteurs (no-op si l'état n'est pas géré,
/// ce qui rend le module inoffensif dans les tests unitaires).
pub fn log(app: &AppHandle, level: LogLevel, scope: &str, message: impl Into<String>) {
    let state = app.state::<AppState>();
    state.sync_log.push(level, scope, message);
}

pub fn info(app: &AppHandle, scope: &str, message: impl Into<String>) {
    log(app, LogLevel::Info, scope, message);
}

pub fn warn(app: &AppHandle, scope: &str, message: impl Into<String>) {
    log(app, LogLevel::Warn, scope, message);
}

pub fn error(app: &AppHandle, scope: &str, message: impl Into<String>) {
    log(app, LogLevel::Error, scope, message);
}

// ---------------------------------------------------------------------------
// Commandes IPC
// ---------------------------------------------------------------------------

/// Dernières entrées du journal, plus récentes d'abord (pollé par l'UI).
#[tauri::command]
pub fn get_sync_logs(
    state: tauri::State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<LogEntry>, String> {
    Ok(state
        .sync_log
        .snapshot(limit.unwrap_or(200).min(MAX_ENTRIES)))
}

/// Exporte le journal complet vers un fichier texte dans le répertoire de
/// données app. Retourne le chemin absolu du fichier écrit.
#[tauri::command]
pub fn export_sync_logs(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let lines = state.sync_log.all_lines();
    if lines.is_empty() {
        return Err("Journal vide : lancez d'abord une synchronisation".into());
    }
    let dir = state.data_dir.join("logs");
    std::fs::create_dir_all(&dir).map_err(|e| format!("dossier logs impossible : {e}"))?;
    let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    let path = dir.join(format!("gestion-drive-sync-{stamp}.log"));
    std::fs::write(&path, lines.join("\n") + "\n")
        .map_err(|e| format!("écriture du journal impossible : {e}"))?;
    Ok(path.display().to_string())
}

/// Vide le journal en mémoire.
#[tauri::command]
pub fn clear_sync_logs(state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.sync_log.clear();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ring_buffer_caps_entries() {
        let s = SyncLogState::default();
        for i in 0..(MAX_ENTRIES + 10) {
            s.push(LogLevel::Info, "pull", format!("m{i}"));
        }
        let snap = s.snapshot(MAX_ENTRIES * 2);
        assert_eq!(snap.len(), MAX_ENTRIES);
        // Les plus anciens ont été jetés : la 1re entrée restante est m10.
        assert_eq!(
            s.all_lines().first().map(|l| l.ends_with("m10")),
            Some(true)
        );
        // snapshot : plus récentes d'abord.
        assert!(snap[0].message.ends_with(&format!("m{}", MAX_ENTRIES + 9)));
    }

    #[test]
    fn line_format_is_stable() {
        let e = LogEntry {
            ts: 1_782_000_000, // 2026-06-21T00:00:00Z
            level: LogLevel::Error,
            scope: "push".into(),
            message: "upload-intent refusé (HTTP 500)".into(),
        };
        let line = e.to_line();
        assert!(line.contains("[ERROR] [push] upload-intent refusé"));
        assert!(line.starts_with("20"));
        assert!(line.contains('T') && line.contains('Z'));
    }

    #[test]
    fn redacts_signed_url_queries_before_storage_and_export() {
        let s = SyncLogState::default();
        s.push(
            LogLevel::Error,
            "pull",
            "request failed for (https://blob.example.test/file?sv=1&sig=secret-value)",
        );

        let message = &s.snapshot(1)[0].message;
        assert!(message.contains("https://blob.example.test/file?[redacted]"));
        assert!(!message.contains("sig="));
        assert!(!s.all_lines()[0].contains("secret-value"));
    }

    #[test]
    fn clear_empties_the_journal() {
        let s = SyncLogState::default();
        s.push(LogLevel::Warn, "system", "x");
        assert_eq!(s.snapshot(10).len(), 1);
        s.clear();
        assert!(s.snapshot(10).is_empty());
    }
}
