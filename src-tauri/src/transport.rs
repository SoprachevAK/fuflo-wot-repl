//! Desktop end of the file-buffer transport.
//!
//! Mirrors the agent's `framebus.py`: append newline-JSON to `d2c`, drain `c2d`,
//! both guarded by exclusive-create `*.lock` files. A background thread polls
//! `c2d`, forwards stdout/hello frames to an event sink, and correlates replies
//! by id.
//!
//! The event sink is a plain closure, so the transport has no Tauri dependency
//! (DIP) and can be exercised in isolation (see the test at the bottom).

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime};

use crate::protocol::{InFrame, LogLine, OutFrame, ServerEvent};

const LOCK_STALE: Duration = Duration::from_secs(5);
const POLL_INTERVAL: Duration = Duration::from_millis(50);

pub type EventSink = Arc<dyn Fn(ServerEvent) + Send + Sync>;

pub struct FileBufferTransport {
    dir: PathBuf,
    pending: Mutex<std::collections::HashMap<String, Sender<OutFrame>>>,
    running: Arc<AtomicBool>,
    sink: EventSink,
}

impl FileBufferTransport {
    pub fn start(dir: PathBuf, sink: EventSink) -> Arc<Self> {
        let transport = Arc::new(Self {
            dir,
            pending: Mutex::new(std::collections::HashMap::new()),
            running: Arc::new(AtomicBool::new(true)),
            sink,
        });
        let worker = Arc::clone(&transport);
        thread::spawn(move || worker.read_loop());
        transport
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::Relaxed);
    }

    /// Send a request and get a receiver that resolves with the matching reply.
    pub fn request(&self, frame: InFrame) -> Receiver<OutFrame> {
        let (tx, rx) = mpsc::channel();
        self.pending
            .lock()
            .unwrap()
            .insert(frame.id().to_string(), tx);
        if let Ok(line) = serde_json::to_string(&frame) {
            self.append("d2c", &line);
        }
        rx
    }

    fn append(&self, name: &str, line: &str) {
        let path = self.dir.join(name);
        let lock = self.dir.join(format!("{name}.lock"));
        if !acquire(&lock) {
            return;
        }
        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&path) {
            let _ = file.write_all(line.as_bytes());
            let _ = file.write_all(b"\n");
        }
        release(&lock);
    }

    fn read_loop(&self) {
        let path = self.dir.join("c2d");
        let lock = self.dir.join("c2d.lock");
        while self.running.load(Ordering::Relaxed) {
            let mut batch = Vec::new();
            for line in drain_file(&path, &lock) {
                match serde_json::from_str::<OutFrame>(&line) {
                    Ok(OutFrame::Stdout {
                        stream,
                        level,
                        text,
                    }) => batch.push(LogLine {
                        stream,
                        level,
                        text,
                    }),
                    Ok(OutFrame::Hello { version, pid }) => {
                        (self.sink)(ServerEvent::Hello { version, pid });
                    }
                    Ok(frame) => {
                        if let Some(id) = frame.correlation_id() {
                            let waiter = self.pending.lock().unwrap().remove(id);
                            if let Some(tx) = waiter {
                                let _ = tx.send(frame);
                            }
                        }
                    }
                    Err(_) => {}
                }
            }
            if !batch.is_empty() {
                (self.sink)(ServerEvent::Log { lines: batch });
            }
            thread::sleep(POLL_INTERVAL);
        }
    }
}

fn drain_file(path: &Path, lock: &Path) -> Vec<String> {
    if !path.exists() {
        return Vec::new();
    }
    if !acquire(lock) {
        return Vec::new();
    }
    let data = fs::read_to_string(path).unwrap_or_default();
    let _ = fs::write(path, b"");
    release(lock);
    data.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| l.to_string())
        .collect()
}

fn acquire(lock: &Path) -> bool {
    let deadline = Instant::now() + Duration::from_secs(2);
    loop {
        match OpenOptions::new().write(true).create_new(true).open(lock) {
            Ok(_) => return true,
            Err(_) => {
                if is_stale(lock) {
                    let _ = fs::remove_file(lock);
                    continue;
                }
                if Instant::now() >= deadline {
                    return false;
                }
                thread::sleep(Duration::from_millis(2));
            }
        }
    }
}

fn release(lock: &Path) {
    let _ = fs::remove_file(lock);
}

fn is_stale(lock: &Path) -> bool {
    fs::metadata(lock)
        .and_then(|m| m.modified())
        .map(|t| SystemTime::now().duration_since(t).unwrap_or_default() > LOCK_STALE)
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::InFrame;
    use std::process::Command;

    fn python27() -> Option<&'static str> {
        let p = "C:/Python27/python.exe";
        if Path::new(p).exists() {
            Some(p)
        } else {
            None
        }
    }

    // Drives the REAL py2.7 agent over the file-buffer transport: Rust writes
    // d2c, the agent execs and writes c2d, Rust correlates the reply by id.
    #[test]
    fn loopback_exec_with_real_agent() {
        let py = match python27() {
            Some(p) => p,
            None => {
                eprintln!("skip: C:/Python27 not present");
                return;
            }
        };
        let runner = concat!(env!("CARGO_MANIFEST_DIR"), "/../agent/run_standalone.py");
        let dir = std::env::temp_dir().join(format!("wms_rust_it_{}", std::process::id()));
        let _ = fs::create_dir_all(&dir);

        let events: Arc<Mutex<Vec<ServerEvent>>> = Arc::new(Mutex::new(Vec::new()));
        let collected = Arc::clone(&events);
        let transport = FileBufferTransport::start(
            dir.clone(),
            Arc::new(move |ev| collected.lock().unwrap().push(ev)),
        );

        let mut child = Command::new(py)
            .arg(runner)
            .arg(dir.to_str().unwrap())
            .spawn()
            .expect("spawn agent");
        thread::sleep(Duration::from_millis(900));

        let rx = transport.request(InFrame::Exec {
            id: "t1".into(),
            code: "21 * 2".into(),
        });
        let frame = rx.recv_timeout(Duration::from_secs(10));

        let got_hello = events
            .lock()
            .unwrap()
            .iter()
            .any(|e| matches!(e, ServerEvent::Hello { .. }));

        let _ = child.kill();
        transport.stop();
        let _ = fs::remove_dir_all(&dir);

        assert!(got_hello, "agent should send a hello handshake on start");
        match frame {
            Ok(OutFrame::Result { repr, ok, .. }) => {
                assert!(ok, "exec should succeed");
                assert_eq!(repr.as_deref(), Some("42"));
            }
            other => panic!("unexpected reply: {other:?}"),
        }
    }
}
