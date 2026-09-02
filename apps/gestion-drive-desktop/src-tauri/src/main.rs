// Entrée binaire Tauri. Toute la logique vit dans lib.rs.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    gestion_drive_desktop_lib::run();
}
