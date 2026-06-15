//! Connection state shared across Tauri commands.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use crate::jedi::JediWorker;
use crate::transport::FileBufferTransport;

#[derive(Default)]
pub struct AppState {
    pub inner: Mutex<SessionInner>,
}

#[derive(Default)]
pub struct SessionInner {
    pub transport: Option<Arc<FileBufferTransport>>,
    pub jedi: Option<Arc<JediWorker>>,
    pub buffer_dir: Option<PathBuf>,
}
