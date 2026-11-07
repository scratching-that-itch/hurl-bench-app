use hurl::runner::{self, AssertResult, HurlResult, RunnerOptionsBuilder, VariableSet};
use hurl::util::logger::LoggerOptionsBuilder;
use hurl_core::input::Input;
use serde::Serialize;
use std::time::Instant;

/// Version of the bundled hurl library (Cargo dependency), reported to the UI.
const BUNDLED_HURL_VERSION: &str = "8.1.0";

#[derive(Serialize)]
pub struct HurlRunOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub duration_ms: u128,
    pub body: String,
    /// Body of each entry's last response, aligned with the report's entries.
    pub bodies: Vec<String>,
    pub report: String,
}

#[derive(Serialize)]
struct ReportFile {
    entries: Vec<ReportEntry>,
}

#[derive(Serialize)]
struct ReportEntry {
    calls: Vec<ReportCall>,
    asserts: Vec<ReportAssert>,
}

#[derive(Serialize)]
struct ReportCall {
    request: ReportRequest,
    response: ReportResponse,
}

#[derive(Serialize)]
struct ReportRequest {
    method: String,
    url: String,
}

#[derive(Serialize)]
struct ReportResponse {
    status: u32,
    http_version: String,
    headers: Vec<ReportHeader>,
}

#[derive(Serialize)]
struct ReportHeader {
    name: String,
    value: String,
}

#[derive(Serialize)]
struct ReportAssert {
    line: usize,
    success: bool,
}

#[tauri::command]
fn hurl_version() -> String {
    format!("hurl {BUNDLED_HURL_VERSION} (bundled)")
}

#[tauri::command]
async fn run_hurl(
    content: String,
    filename: Option<String>,
    file_root: Option<String>,
) -> Result<HurlRunOutput, String> {
    let filename = filename.unwrap_or_else(|| "request.hurl".to_string());
    tauri::async_runtime::spawn_blocking(move || {
        Ok(execute_hurl(&content, &filename, file_root.as_deref()))
    })
    .await
    .map_err(|e| format!("task join error: {e}"))?
}

/// Runs hurl content in-process with the bundled hurl library and returns
/// the same output shape the frontend expects from the old CLI runner.
/// `file_root` is the absolute directory of the source file, used to resolve
/// `file,fixtures/...` body references the same way the CLI does.
pub fn execute_hurl(content: &str, filename: &str, file_root: Option<&str>) -> HurlRunOutput {
    let start = Instant::now();
    let mut runner_opts = RunnerOptionsBuilder::new();
    if let Some(root) = file_root {
        let root = std::path::Path::new(root);
        runner_opts.context_dir(&hurl::util::path::ContextDir::new(root, root));
    }
    let runner_opts = runner_opts.build();
    let logger_opts = LoggerOptionsBuilder::new().build();
    let variables = VariableSet::new();
    let input = Input::new(filename);

    let result = runner::run(
        content,
        Some(&input),
        &runner_opts,
        &variables,
        &logger_opts,
    );
    let duration_ms = start.elapsed().as_millis();

    match result {
        Err(parse_error) => HurlRunOutput {
            stdout: String::new(),
            stderr: parse_error,
            exit_code: 2,
            duration_ms,
            body: String::new(),
            bodies: Vec::new(),
            report: String::new(),
        },
        Ok(res) => {
            let bodies = entry_bodies(&res);
            HurlRunOutput {
                stdout: cli_progress(content, filename, &res),
                stderr: cli_errors(content, filename, &res),
                exit_code: if res.success { 0 } else { 1 },
                duration_ms,
                body: bodies.last().cloned().unwrap_or_default(),
                bodies,
                report: build_report(&res),
            }
        }
    }
}

/// CLI `--test`-style progress output:
/// `file.hurl: Running [1/2]` per executed entry, then a
/// `Success|Failure (N request(s) in D ms)` summary line.
fn cli_progress(content: &str, filename: &str, result: &HurlResult) -> String {
    let total = hurl_core::parser::parse_hurl_file(content)
        .map(|f| f.entries.len())
        .unwrap_or(result.entries.len());
    let mut out = String::new();
    for (i, _) in result.entries.iter().enumerate() {
        out.push_str(&format!("{filename}: Running [{}/{}]\n", i + 1, total));
    }
    let requests = result.entries.iter().flat_map(|e| &e.calls).count();
    let status = if result.success { "Success" } else { "Failure" };
    out.push_str(&format!(
        "{filename}: {status} ({requests} request(s) in {} ms)\n",
        result.duration.as_millis()
    ));
    out
}

/// CLI-style annotated error blocks (`error: ... --> file:line:col` with the
/// source snippet), one per effective error, without color.
fn cli_errors(content: &str, filename: &str, result: &HurlResult) -> String {
    use hurl_core::error::{DisplaySourceError, OutputFormat};
    result
        .errors()
        .iter()
        .map(|(error, src_info)| {
            // The CLI's logger prefixes the description line with "error: ".
            format!(
                "error: {}",
                error.render(
                    filename,
                    content,
                    Some(*src_info),
                    OutputFormat::Terminal(false),
                )
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Body of each entry's last call (after redirects), uncompressed when the
/// entry was executed with compression.
fn entry_bodies(result: &HurlResult) -> Vec<String> {
    result
        .entries
        .iter()
        .map(|entry| {
            let Some(response) = entry.calls.last().map(|c| &c.response) else {
                return String::new();
            };
            let bytes = response
                .uncompress_body()
                .unwrap_or_else(|_| response.body.clone());
            String::from_utf8_lossy(&bytes).into_owned()
        })
        .collect()
}

/// Same JSON shape as the CLI's `--report-json`, so the frontend parser
/// stays identical to the CLI-based implementation.
fn build_report(result: &HurlResult) -> String {
    let file = ReportFile {
        entries: result
            .entries
            .iter()
            .map(|entry| ReportEntry {
                calls: entry
                    .calls
                    .iter()
                    .map(|call| ReportCall {
                        request: ReportRequest {
                            method: call.request.method.to_string(),
                            url: call.request.url.to_string(),
                        },
                        response: ReportResponse {
                            status: call.response.status,
                            http_version: call.response.version.to_string(),
                            headers: call
                                .response
                                .headers
                                .iter()
                                .map(|h| ReportHeader {
                                    name: h.name.clone(),
                                    value: h.value.clone(),
                                })
                                .collect(),
                        },
                    })
                    .collect(),
                asserts: entry.asserts.iter().map(report_assert).collect(),
            })
            .collect(),
    };
    serde_json::to_string(&[file]).unwrap_or_default()
}

fn report_assert(assert: &AssertResult) -> ReportAssert {
    ReportAssert {
        line: assert.line(),
        success: assert.to_runner_error().is_none(),
    }
}

#[derive(Serialize)]
pub struct HurlFileInfo {
    /// Path relative to the workspace root, using `/` separators.
    pub rel_path: String,
    pub name: String,
}

fn walk_hurl_files(root: &std::path::Path, dir: &std::path::Path, out: &mut Vec<HurlFileInfo>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if entry.file_name().to_string_lossy().starts_with('.') {
                continue;
            }
            walk_hurl_files(root, &path, out);
        } else if path.extension().map(|e| e == "hurl").unwrap_or(false) {
            let rel = path
                .strip_prefix(root)
                .map(|p| p.to_string_lossy().replace('\\', "/"))
                .unwrap_or_else(|_| path.to_string_lossy().into_owned());
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default();
            out.push(HurlFileInfo {
                rel_path: rel,
                name,
            });
        }
    }
}

#[tauri::command]
fn list_hurl_files(dir: String) -> Result<Vec<HurlFileInfo>, String> {
    let root = std::path::PathBuf::from(&dir);
    if !root.is_dir() {
        return Err(format!("not a directory: {dir}"));
    }
    let mut files = Vec::new();
    walk_hurl_files(&root, &root, &mut files);
    files.sort_by(|a, b| a.rel_path.cmp(&b.rel_path));
    Ok(files)
}

fn walk_hurl_folders(root: &std::path::Path, dir: &std::path::Path, out: &mut Vec<String>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() || entry.file_name().to_string_lossy().starts_with('.') {
            continue;
        }
        let rel = path
            .strip_prefix(root)
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_else(|_| path.to_string_lossy().into_owned());
        out.push(rel);
        walk_hurl_folders(root, &path, out);
    }
}

#[tauri::command]
fn list_hurl_folders(dir: String) -> Result<Vec<String>, String> {
    let root = std::path::PathBuf::from(&dir);
    if !root.is_dir() {
        return Err(format!("not a directory: {dir}"));
    }
    let mut folders = Vec::new();
    walk_hurl_folders(&root, &root, &mut folders);
    folders.sort();
    Ok(folders)
}

#[derive(Serialize)]
struct HistoryFileInfo {
    name: String,
    path: String,
    /// Value of the `# Entry:` header line, when the run was a single entry.
    entry: Option<String>,
}

#[tauri::command]
fn list_history_files(dir: String, rel_path: String) -> Result<Vec<HistoryFileInfo>, String> {
    let root = std::path::PathBuf::from(&dir);
    let rel = std::path::PathBuf::from(&rel_path);
    let stem = rel
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let parent = root.join(rel.parent().unwrap_or(std::path::Path::new("")));
    let Ok(entries) = std::fs::read_dir(&parent) else {
        return Ok(Vec::new());
    };
    let prefix = format!("{stem}.");
    let mut out = Vec::new();
    for dir_entry in entries.flatten() {
        let name = dir_entry.file_name().to_string_lossy().into_owned();
        if name.starts_with(&prefix) && name.ends_with(".history.txt") {
            let path = dir_entry.path();
            let entry = std::fs::read_to_string(&path)
                .ok()
                .and_then(|text| {
                    text.lines()
                        .take(8)
                        .find_map(|l| l.strip_prefix("# Entry: ").map(|v| v.trim().to_string()))
                });
            out.push(HistoryFileInfo {
                name,
                path: path.to_string_lossy().into_owned(),
                entry,
            });
        }
    }
    out.sort_by(|a, b| b.name.cmp(&a.name));
    Ok(out)
}

#[tauri::command]
fn read_hurl_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("failed to read {path}: {e}"))
}

#[tauri::command]
fn write_hurl_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| format!("failed to write {path}: {e}"))
}

#[tauri::command]
fn create_hurl_file(dir: String, rel_path: String) -> Result<(), String> {
    let mut rel = rel_path.trim().trim_matches('/').to_string();
    if rel.is_empty() {
        return Err("empty file name".to_string());
    }
    if !rel.ends_with(".hurl") {
        rel.push_str(".hurl");
    }
    if rel.split('/').any(|seg| seg == ".." || seg.is_empty()) {
        return Err(format!("invalid path: {rel}"));
    }
    let path = std::path::PathBuf::from(&dir).join(&rel);
    if path.exists() {
        return Err(format!("file already exists: {rel}"));
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("failed to create dirs: {e}"))?;
    }
    std::fs::write(&path, "").map_err(|e| format!("failed to create {rel}: {e}"))
}

#[tauri::command]
fn create_hurl_folder(dir: String, rel_path: String) -> Result<(), String> {
    let rel = rel_path.trim().trim_matches('/').to_string();
    if rel.is_empty() {
        return Err("empty folder name".to_string());
    }
    if rel.split('/').any(|seg| seg == ".." || seg.is_empty()) {
        return Err(format!("invalid path: {rel}"));
    }
    let path = std::path::PathBuf::from(&dir).join(&rel);
    if path.exists() {
        return Err(format!("folder already exists: {rel}"));
    }
    std::fs::create_dir_all(&path).map_err(|e| format!("failed to create {rel}: {e}"))
}

#[tauri::command]
fn delete_hurl_file(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| format!("failed to delete {path}: {e}"))
}

#[tauri::command]
fn delete_hurl_folder(dir: String, rel_path: String) -> Result<(), String> {
    let rel = rel_path.trim().trim_matches('/').to_string();
    if rel.is_empty() {
        return Err("empty folder path".to_string());
    }
    if rel.split('/').any(|seg| seg == ".." || seg.is_empty()) {
        return Err(format!("invalid path: {rel}"));
    }
    let path = std::path::PathBuf::from(&dir).join(&rel);
    if !path.is_dir() {
        return Err(format!("not a folder: {rel}"));
    }
    std::fs::remove_dir_all(&path).map_err(|e| format!("failed to delete {rel}: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            hurl_version,
            run_hurl,
            list_hurl_files,
            list_hurl_folders,
            list_history_files,
            read_hurl_file,
            write_hurl_file,
            create_hurl_file,
            create_hurl_folder,
            delete_hurl_file,
            delete_hurl_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
