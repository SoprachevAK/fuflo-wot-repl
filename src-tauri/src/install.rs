//! Automated setup, PJOrion-style: locate the client, drop the bundled agent
//! mod into it, and launch it. The agent `.mtmod` is embedded in the binary so
//! no Python 2.7 toolchain is needed at runtime.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;

/// Prebuilt py2.7 agent package, compiled at dev time (see agent/build_mtmod.py).
const AGENT_MTMOD: &[u8] = include_bytes!("../resources/me.fuflo.wotrepl.mtmod");
const MTMOD_NAME: &str = "me.fuflo.wotrepl.mtmod";

const EXES: [&str; 4] = ["Tanki.exe", "WorldOfTanks.exe", "WoT.exe", "wot.exe"];
const ROOTS: [&str; 8] = [
    "C:/Games",
    "C:/Program Files",
    "C:/Program Files (x86)",
    "D:/Games",
    "E:/Games",
    "U:/Games",
    "U:/Programs",
    "D:/",
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameInfo {
    pub path: String,
    pub version: String,
    pub mods_version: String,
    pub exe: String,
    pub installed: bool,
}

fn app_data_root() -> PathBuf {
    let base = std::env::var("LOCALAPPDATA")
        .or_else(|_| std::env::var("APPDATA"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(base).join("FufloWoTREPL")
}

pub fn default_buffer_dir_path() -> PathBuf {
    app_data_root().join("buffer")
}

/// Canonical jedi sys_path root for runtime-generated native-module stubs.
pub fn stubs_dir_path() -> PathBuf {
    app_data_root().join("stubs")
}

/// Persist runtime dump stubs as `<type>.pyi` files; returns the stubs dir.
pub fn write_stubs(stubs: &std::collections::HashMap<String, String>) -> Result<String, String> {
    let dir = stubs_dir_path();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    for (module, body) in stubs {
        // Guard against path traversal from a module name.
        if module.is_empty() || module.contains(['/', '\\', '.', ':']) {
            continue;
        }
        fs::write(dir.join(format!("{module}.pyi")), body).map_err(|e| e.to_string())?;
    }
    Ok(dir.to_string_lossy().into_owned())
}

pub fn detect_games() -> Vec<GameInfo> {
    let mut out = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for root in ROOTS {
        let root_path = Path::new(root);
        if !root_path.is_dir() {
            continue;
        }
        let Ok(entries) = fs::read_dir(root_path) else {
            continue;
        };
        for entry in entries.flatten() {
            let dir = entry.path();
            if !dir.is_dir() {
                continue;
            }
            if let Some(exe) = EXES.iter().find(|e| dir.join(e).is_file()) {
                if let Some(info) = read_game(&dir, exe) {
                    if seen.insert(info.path.clone()) {
                        out.push(info);
                    }
                }
            }
        }
    }
    out
}

fn read_game(dir: &Path, exe: &str) -> Option<GameInfo> {
    let version = fs::read_to_string(dir.join("version.xml"))
        .ok()
        .and_then(|s| extract_version(&s))
        .unwrap_or_default();
    let mods_version = pick_mods_version(dir, &version);
    let installed = dir
        .join("mods")
        .join(&mods_version)
        .join(MTMOD_NAME)
        .is_file();
    Some(GameInfo {
        path: dir.to_string_lossy().into_owned(),
        version,
        mods_version,
        exe: exe.to_string(),
        installed,
    })
}

/// Pull the `1.43.0.0` token out of `<version> v.1.43.0.0 #2244 </version>`.
fn extract_version(xml: &str) -> Option<String> {
    let idx = xml.find("v.")?;
    let tail = &xml[idx + 2..];
    let token: String = tail
        .chars()
        .take_while(|c| c.is_ascii_digit() || *c == '.')
        .collect();
    if token.split('.').count() >= 3 {
        Some(token)
    } else {
        None
    }
}

/// Prefer the exact `mods/<version>` folder; otherwise the lexically-greatest
/// version-like subfolder of `mods/`; otherwise the parsed version itself.
fn pick_mods_version(dir: &Path, version: &str) -> String {
    let mods = dir.join("mods");
    if !version.is_empty() && mods.join(version).is_dir() {
        return version.to_string();
    }
    let mut candidates: Vec<String> = fs::read_dir(&mods)
        .into_iter()
        .flatten()
        .flatten()
        .filter(|e| e.path().is_dir())
        .filter_map(|e| e.file_name().into_string().ok())
        .filter(|n| n.chars().next().is_some_and(|c| c.is_ascii_digit()))
        .collect();
    candidates.sort();
    candidates.pop().unwrap_or_else(|| version.to_string())
}

pub fn install_agent(game_dir: &str, mods_version: &str) -> Result<String, String> {
    if mods_version.trim().is_empty() {
        return Err("missing mods version".into());
    }
    let mods_dir = PathBuf::from(game_dir).join("mods").join(mods_version);
    fs::create_dir_all(&mods_dir).map_err(|e| e.to_string())?;
    // Drop any previous build of ours (old gui.mods variant included).
    if let Ok(entries) = fs::read_dir(&mods_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with("me.fuflo.wotrepl") || name.starts_with("me.wms.agent") {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
    fs::write(mods_dir.join(MTMOD_NAME), AGENT_MTMOD).map_err(|e| e.to_string())?;
    let buffer = default_buffer_dir_path();
    fs::create_dir_all(&buffer).map_err(|e| e.to_string())?;
    Ok(buffer.to_string_lossy().into_owned())
}

pub fn launch_game(game_dir: &str, exe: &str) -> Result<(), String> {
    let exe_path = PathBuf::from(game_dir).join(exe);
    if !exe_path.is_file() {
        return Err(format!("launcher not found: {}", exe_path.display()));
    }
    Command::new(&exe_path)
        .current_dir(game_dir)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
