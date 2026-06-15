//! Supervisor for the CPython 2.7 jedi worker (tools/jedi_worker/worker.py).
//!
//! One long-lived child, JSON-over-stdio, replies correlated by `id`. The worker
//! handles py2.7 grammar; the backend stays agnostic to that.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;

use serde_json::Value;

pub struct JediWorker {
    stdin: Mutex<ChildStdin>,
    pending: Arc<Mutex<HashMap<String, Sender<Value>>>>,
    _child: Child,
}

impl JediWorker {
    pub fn spawn(python: &str, script: &str) -> std::io::Result<Arc<Self>> {
        let mut child = Command::new(python)
            .arg(script)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::BrokenPipe, "piped stdin"))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::BrokenPipe, "piped stdout"))?;
        let pending: Arc<Mutex<HashMap<String, Sender<Value>>>> =
            Arc::new(Mutex::new(HashMap::new()));

        let reader_pending = Arc::clone(&pending);
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                let line = match line {
                    Ok(l) => l,
                    Err(_) => break,
                };
                if let Ok(value) = serde_json::from_str::<Value>(&line) {
                    if let Some(id) = value.get("id").and_then(Value::as_str) {
                        let waiter = reader_pending.lock().unwrap().remove(id);
                        if let Some(tx) = waiter {
                            let _ = tx.send(value);
                        }
                    }
                }
            }
        });

        Ok(Arc::new(Self {
            stdin: Mutex::new(stdin),
            pending,
            _child: child,
        }))
    }

    pub fn request(&self, mut req: Value) -> std::io::Result<Receiver<Value>> {
        let id = match req.get("id").and_then(Value::as_str) {
            Some(existing) => existing.to_string(),
            None => {
                let generated = uuid::Uuid::new_v4().to_string();
                req["id"] = Value::String(generated.clone());
                generated
            }
        };
        let (tx, rx) = mpsc::channel();
        self.pending
            .lock()
            .map_err(|_| std::io::Error::other("state lock poisoned"))?
            .insert(id, tx);
        let serialized = serde_json::to_string(&req)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
        let line = serialized + "\n";
        let mut stdin = self.stdin
            .lock()
            .map_err(|_| std::io::Error::other("stdin lock poisoned"))?;
        stdin.write_all(line.as_bytes())?;
        stdin.flush()?;
        Ok(rx)
    }
}
