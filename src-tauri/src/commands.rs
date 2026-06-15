//! Tauri command surface: the only desktop<->backend boundary.

use std::path::PathBuf;
use std::sync::mpsc::Receiver;
use std::sync::Arc;
use std::time::Duration;

use serde_json::{json, Value};
use tauri::ipc::Channel;
use tauri::State;

use crate::install::{self, GameInfo};
use crate::jedi::JediWorker;
use crate::protocol::{InFrame, OutFrame, ServerEvent};
use crate::session::AppState;
use crate::transport::{EventSink, FileBufferTransport};

const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

async fn await_frame(rx: Receiver<OutFrame>) -> Result<OutFrame, String> {
    tauri::async_runtime::spawn_blocking(move || rx.recv_timeout(REQUEST_TIMEOUT))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|_| "agent did not respond in time".to_string())
}

async fn await_value(rx: Receiver<Value>, timeout: Duration) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || rx.recv_timeout(timeout))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|_| "jedi worker did not respond in time".to_string())
}

fn transport(state: &State<'_, AppState>) -> Result<Arc<FileBufferTransport>, String> {
    state
        .inner
        .lock()
        .map_err(|_| "state lock poisoned".to_string())?
        .transport
        .clone()
        .ok_or_else(|| "not connected".to_string())
}

fn jedi(state: &State<'_, AppState>) -> Result<Arc<JediWorker>, String> {
    state
        .inner
        .lock()
        .map_err(|_| "state lock poisoned".to_string())?
        .jedi
        .clone()
        .ok_or_else(|| "jedi worker not started".to_string())
}

async fn request_outframe(
    state: &State<'_, AppState>,
    frame: InFrame,
) -> Result<OutFrame, String> {
    let rx = transport(state)?.request(frame);
    await_frame(rx).await
}

async fn jedi_request(
    worker: &JediWorker,
    payload: serde_json::Value,
    timeout: Duration,
) -> Result<serde_json::Value, String> {
    let rx = worker.request(payload).map_err(|e| e.to_string())?;
    await_value(rx, timeout).await
}

#[tauri::command]
pub fn ping() -> &'static str {
    "pong"
}

#[tauri::command]
pub fn default_buffer_dir() -> String {
    install::default_buffer_dir_path()
        .to_string_lossy()
        .into_owned()
}

#[tauri::command]
pub fn stubs_dir() -> String {
    install::stubs_dir_path().to_string_lossy().into_owned()
}

/// Persist runtime-generated `.pyi` stubs to the canonical jedi sys_path root.
#[tauri::command]
pub fn write_stubs(
    stubs: std::collections::HashMap<String, String>,
) -> Result<String, String> {
    install::write_stubs(&stubs)
}

// --- Automated setup (PJOrion-style) ------------------------------------------

#[tauri::command]
pub fn detect_games() -> Vec<GameInfo> {
    install::detect_games()
}

/// Validate a manually-picked folder; `None` if it isn't a WoT/Tanki install.
#[tauri::command]
pub fn inspect_game_dir(dir: String) -> Option<GameInfo> {
    install::inspect_dir(std::path::Path::new(&dir))
}

#[tauri::command]
pub fn install_agent(game_dir: String, mods_version: String) -> Result<String, String> {
    install::install_agent(&game_dir, &mods_version)
}

#[tauri::command]
pub fn launch_game(game_dir: String, exe: String) -> Result<(), String> {
    install::launch_game(&game_dir, &exe)
}

// --- Session ------------------------------------------------------------------

#[tauri::command]
pub fn connect(
    state: State<'_, AppState>,
    buffer_dir: String,
    on_event: Channel<ServerEvent>,
) -> Result<(), String> {
    let dir = PathBuf::from(&buffer_dir);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let sink: EventSink = Arc::new(move |event| {
        let _ = on_event.send(event);
    });
    let transport = FileBufferTransport::start(dir.clone(), sink);
    let mut inner = state
        .inner
        .lock()
        .map_err(|_| "state lock poisoned".to_string())?;
    inner.transport = Some(transport);
    inner.buffer_dir = Some(dir);
    Ok(())
}

#[tauri::command]
pub fn disconnect(state: State<'_, AppState>) -> Result<(), String> {
    let mut inner = state
        .inner
        .lock()
        .map_err(|_| "state lock poisoned".to_string())?;
    if let Some(transport) = inner.transport.take() {
        transport.stop();
    }
    inner.buffer_dir = None;
    Ok(())
}

#[tauri::command]
pub async fn exec_code(state: State<'_, AppState>, code: String) -> Result<OutFrame, String> {
    request_outframe(&state, InFrame::Exec { id: new_id(), code }).await
}

#[tauri::command]
pub async fn complete(state: State<'_, AppState>, prefix: String) -> Result<OutFrame, String> {
    request_outframe(&state, InFrame::Complete { id: new_id(), prefix }).await
}

#[tauri::command]
pub async fn inspect(state: State<'_, AppState>, expr: String) -> Result<OutFrame, String> {
    request_outframe(&state, InFrame::Inspect { id: new_id(), expr }).await
}

#[tauri::command]
pub async fn lint_code(state: State<'_, AppState>, code: String) -> Result<OutFrame, String> {
    request_outframe(&state, InFrame::Lint { id: new_id(), code }).await
}

/// Deep runtime introspection of a live expression (e.g. "BigWorld.player()").
/// Persists any runtime-informed `.pyi` class stubs it returns to the stubs dir.
#[tauri::command]
pub async fn dump_object(
    state: State<'_, AppState>,
    expr: String,
    depth: u32,
) -> Result<OutFrame, String> {
    let rx = transport(&state)?.request(InFrame::Dump {
        id: new_id(),
        expr,
        depth,
    });
    let frame = await_frame(rx).await?;
    if let OutFrame::Dump { stubs, .. } = &frame {
        if !stubs.is_empty() {
            let _ = install::write_stubs(stubs);
        }
    }
    Ok(frame)
}

// --- jedi static worker -------------------------------------------------------

#[tauri::command]
pub async fn jedi_start(
    state: State<'_, AppState>,
    python: String,
    script: String,
    root: String,
    sys_path: Vec<String>,
) -> Result<Value, String> {
    let worker = JediWorker::spawn(&python, &script).map_err(|e| e.to_string())?;
    let result = jedi_request(
        &worker,
        json!({ "op": "configure", "root": root, "sys_path": sys_path }),
        Duration::from_secs(20),
    )
    .await?;
    state
        .inner
        .lock()
        .map_err(|_| "state lock poisoned".to_string())?
        .jedi = Some(Arc::clone(&worker));
    Ok(result)
}

#[tauri::command]
pub async fn jedi_complete(
    state: State<'_, AppState>,
    code: String,
    line: u32,
    column: u32,
) -> Result<Value, String> {
    let worker = jedi(&state)?;
    jedi_request(
        &worker,
        json!({ "op": "complete", "code": code, "line": line, "column": column }),
        REQUEST_TIMEOUT,
    )
    .await
}

#[tauri::command]
pub async fn jedi_lint(state: State<'_, AppState>, code: String) -> Result<Value, String> {
    let worker = jedi(&state)?;
    jedi_request(&worker, json!({ "op": "lint", "code": code }), REQUEST_TIMEOUT).await
}
