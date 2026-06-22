# Graphify Reference Guide

This document consolidates all supplementary developer reference materials for `graphify`.

---

## 1. Add URL & Watch Folder (`add-watch.md`)

Loaded when `/graphify add <url>` is run or the `--watch` flag is passed. Neither is part of the default build.

### A. For `/graphify add`
Fetches a URL, adds it to the corpus, and updates the graph.

```bash
$(cat graphify-out/.graphify_python) -c "
import sys
from graphify.ingest import ingest
from pathlib import Path

try:
    out = ingest('URL', Path('./raw'), author='AUTHOR', contributor='CONTRIBUTOR')
    print(f'Saved to {out}')
except ValueError as e:
    print(f'error: {e}', file=sys.stderr)
    sys.exit(1)
except RuntimeError as e:
    print(f'error: {e}', file=sys.stderr)
    sys.exit(1)
"
```

Replace `URL` with the actual URL, `AUTHOR` with the user's name if provided, and `CONTRIBUTOR` likewise. If the command exits with an error, report the error - do not silently continue. After a successful save, automatically run the `--update` pipeline on `./raw` to merge the new file into the existing graph.

Supported URL types (auto-detected):
- **YouTube / any video URL**: Audio downloaded via `yt-dlp`, transcribed to `.txt` on next run (requires `pip install 'graphifyy[video]'`).
- **Twitter/X**: Fetched via oEmbed, saved as `.md` with tweet text and author.
- **arXiv**: Abstract + metadata saved as `.md`.
- **PDF**: Downloaded as `.pdf`.
- **Images (.png/.jpg/.webp)**: Downloaded, Claude vision extracts on next run.
- **Any webpage**: Converted to markdown via `html2text`.

### B. For `--watch`
Starts a background watcher that monitors a folder and auto-updates the graph when files change.

```bash
python3 -m graphify.watch INPUT_PATH --debounce 3
```

Replace `INPUT_PATH` with the folder to watch. Behavior depends on what changed:
- **Code files only (`.py`, `.ts`, `.go`, etc.)**: Re-runs AST extraction, rebuild, and cluster immediately, no LLM needed. `graph.json` and `GRAPH_REPORT.md` are updated automatically.
- **Docs, papers, or images**: Writes a `graphify-out/needs_update` flag and prints a notification to run `/graphify --update` (LLM semantic re-extraction required).

*Debounce (default 3s)*: Waits until file activity stops before triggering, so a wave of parallel agent writes doesn't trigger a rebuild per file.
Press `Ctrl+C` to stop.
For agentic workflows, run `--watch` in a background terminal. Code changes from agent waves are picked up automatically. If agents also write docs or notes, a manual `/graphify --update` is required.

---

## 2. Extra Exports & Benchmarks (`exports.md`)

Loaded when export flags are passed (`--wiki`, `--neo4j`, `--neo4j-push`, `--falkordb`, `--falkordb-push`, `--svg`, `--graphml`, `--mcp`), or when the corpus is large enough for the token-reduction benchmark.

### A. Wiki Export (`--wiki`)
Run this before Step 9 (cleanup) so `.graphify_labels.json` is still available.
```bash
graphify export wiki
```

### B. Neo4j Export (`--neo4j` / `--neo4j-push`)
- **If `--neo4j`**: Generate a Cypher file for manual import:
  ```bash
  graphify export neo4j
  ```
- **If `--neo4j-push <uri>`**: Push directly to a running Neo4j instance:
  ```bash
  graphify export neo4j --push bolt://localhost:7687 --user neo4j --password PASSWORD
  ```
  Default URI is `bolt://localhost:7687`, default user is `neo4j`. Uses `MERGE` (safe to re-run).

### C. FalkorDB Export (`--falkordb` / `--falkordb-push`)
- **If `--falkordb`**: Generate a Cypher file:
  ```bash
  graphify export falkordb
  ```
- **If `--falkordb-push <uri>`**: Push directly to a running FalkorDB instance:
  ```bash
  graphify export falkordb --push falkordb://localhost:6379
  ```
  Default URI is `falkordb://localhost:6379`, target graph defaults to `graphify`. Uses `MERGE` (safe to re-run).

### D. SVG Export (`--svg`)
```bash
graphify export svg
```

### E. GraphML Export (`--graphml`)
```bash
graphify export graphml
```

### F. MCP Server (`--mcp`)
Starts a stdio MCP server that exposes tools (`query_graph`, `get_node`, `get_neighbors`, `get_community`, `god_nodes`, `graph_stats`, `shortest_path`):
```bash
python3 -m graphify.serve graphify-out/graph.json
```
To configure in Claude Desktop, add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "graphify": {
      "command": "python3",
      "args": ["-m", "graphify.serve", "/absolute/path/to/graphify-out/graph.json"]
    }
  }
}
```

### G. Token Reduction Benchmark (only if `total_words > 5000`)
If `total_words` from `graphify-out/.graphify_detect.json` is greater than 5,000, run:
```bash
graphify benchmark
```
If `total_words <= 5000`, skip.

---

## 3. Extraction Subagent Prompt (`extraction-spec.md`)

Loaded in Step 3 Part B when the corpus has at least one doc, paper, or image chunk. Semantic subagents receive this prompt verbatim (substitute variables: `FILE_LIST`, `CHUNK_NUM`, `TOTAL_CHUNKS`, `DEEP_MODE`, and `CHUNK_PATH`).

```
You are a graphify extraction subagent. Read the files listed and extract a knowledge graph fragment.
Output ONLY valid JSON matching the schema below - no explanation, no markdown fences, no preamble.

Files (chunk CHUNK_NUM of TOTAL_CHUNKS):
FILE_LIST

Rules:
- EXTRACTED: relationship explicit in source (import, call, citation, "see §3.2")
- INFERRED: reasonable inference (shared data structure, implied dependency)
- AMBIGUOUS: uncertain - flag for review, do not omit

Code files: focus on semantic edges AST cannot find (call relationships, shared data, arch patterns).
  Do not re-extract imports - AST already has those.
Doc/paper files: extract named concepts, entities, citations. For rationale (WHY decisions were made, trade-offs, design intent): store as a `rationale` attribute on the relevant concept node — do NOT create a separate rationale node or fragment node. Only create a node for something that is itself a named entity or concept. Use `file_type:"rationale"` for concept-like nodes (ideas, principles, mechanisms, design patterns). `file_type` MUST be one of exactly these six values: `code`, `document`, `paper`, `image`, `rationale`, `concept`. Any other value is invalid and will be rejected.
Code files: when adding `calls` edges, source MUST be the caller (the function/class doing the calling), target MUST be the callee. Never reverse this direction. `calls` edges MUST stay within one language: a Python function cannot `calls` a JS/TS/Go/Rust/Java symbol and vice versa — cross-language call edges are phantom artifacts, never emit them.
Image files: use vision to understand what the image IS - do not just OCR.
  UI screenshot: layout patterns, design decisions, key elements, purpose.
  Chart: metric, trend/insight, data source.
  Tweet/post: claim as node, author, concepts mentioned.
  Diagram: components and connections.
  Research figure: what it demonstrates, method, result.
  Handwritten/whiteboard: ideas and arrows, mark uncertain readings AMBIGUOUS.

DEEP_MODE (if --mode deep was given): be aggressive with INFERRED edges - indirect deps,
  shared assumptions, latent couplings. Mark uncertain ones AMBIGUOUS instead of omitting.

Semantic similarity: if two concepts in this chunk solve the same problem or represent the same idea without any structural link (no import, no call, no citation), add a `semantically_similar_to` edge marked INFERRED with a confidence_score reflecting how similar they are (0.6-0.95). Examples:
- Two functions that both validate user input but never call each other
- A class in code and a concept in a paper that describe the same algorithm
- Two error types that handle the same failure mode differently
Only add these when the similarity is genuinely non-obvious and cross-cutting. Do not add them for trivially similar things.

Hyperedges: if 3 or more nodes clearly participate together in a shared concept, flow, or pattern that is not captured by pairwise edges alone, add a hyperedge to a top-level `hyperedges` array. Examples:
- All classes that implement a common protocol or interface
- All functions in an authentication flow (even if they don't all call each other)
- All concepts from a paper section that form one coherent idea
Use sparingly — only when the group relationship adds information beyond the pairwise edges. Maximum 3 hyperedges per chunk.

If a file has YAML frontmatter (--- ... ---), copy source_url, captured_at, author,
  contributor onto every node from that file.

confidence_score is REQUIRED on every edge - never omit it, never use 0.5 as a default:
- EXTRACTED edges: confidence_score = 1.0 always
- INFERRED edges: pick exactly ONE value from this set — never 0.5:
    0.95  direct structural evidence (shared data structure, named cross-file reference).
    0.85  strong inference (clear functional alignment, no direct symbol link).
    0.75  reasonable inference (shared problem domain + similar shape, requires interpretation).
    0.65  weak inference (thematically related, no shape evidence).
    0.55  speculative but plausible (surface-level co-occurrence only).
  Models follow discrete rubrics better than continuous ranges; the bimodal
  distribution observed in production (>50% at 0.5, >40% at 0.85+) shows the
  range guidance is being collapsed to a binary. If no value above fits, mark
  the edge AMBIGUOUS rather than picking 0.4 or below.
- AMBIGUOUS edges: 0.1-0.3

Node ID format: lowercase, only `[a-z0-9_]`, no dots or slashes. Format: `{stem}_{entity}` where stem is `{parent_dir}_{filename_without_ext}` (the **immediate** parent directory name + the filename stem, both lowercased with non-alphanumeric chars replaced by `_`) and entity is the symbol name similarly normalized. Only one level of parent is used — not the full path. Examples: `src/auth/session.py` + `ValidateToken` → `auth_session_validatetoken`; `lib/utils/helpers.py` + `parse_url` → `utils_helpers_parse_url`; `tests/test_foo.py` + `_helper` → `tests_test_foo_helper`. Top-level files (no parent dir, e.g. `setup.py`) use just the filename stem: `setup_my_func`. This must match the ID the AST extractor generates — using just the filename (e.g., `session_validatetoken`) or the full path (e.g., `src_auth_session_validatetoken`) will create orphan ghost-duplicate nodes. If you are re-extracting a project that had ghost duplicates under the old format, the user should run `graphify extract --force` to rebuild cleanly. CRITICAL: never append chunk numbers, sequence numbers, or any suffix to an ID (no `_c1`, `_c2`, `_chunk2`, etc.). IDs must be deterministic from the label alone — the same entity must always produce the same ID regardless of which chunk processes it.

Generate the extraction JSON matching this schema exactly:
{"nodes":[{"id":"session_validatetoken","label":"Human Readable Name","file_type":"code|document|paper|image|rationale|concept","source_file":"relative/path","source_location":null,"source_url":null,"captured_at":null,"author":null,"contributor":null}],"edges":[{"source":"node_id","target":"node_id","relation":"calls|implements|references|cites|conceptually_related_to|shares_data_with|semantically_similar_to|rationale_for","confidence":"EXTRACTED|INFERRED|AMBIGUOUS","confidence_score":1.0,"source_file":"relative/path","source_location":null,"weight":1.0}],"hyperedges":[{"id":"snake_case_id","label":"Human Readable Label","nodes":["node_id1","node_id2","node_id3"],"relation":"participate_in|implement|form","confidence":"EXTRACTED|INFERRED","confidence_score":0.75,"source_file":"relative/path"}],"input_tokens":0,"output_tokens":0}

Then write the JSON to disk using the Write tool at this exact absolute path (no relative paths — Write resolves relative paths against an undefined cwd and the file will be silently lost):
CHUNK_PATH
```

---

## 4. GitHub Clone & Cross-Repo Merge (`github-and-merge.md`)

Loaded when a `https://github.com/...` URL is passed, or when merging multiple local subfolders.

### A. Clone GitHub repo(s)
- **Single repo**:
  ```bash
  LOCAL_PATH=$(graphify clone <github-url> [--branch <branch>])
  # Use LOCAL_PATH as the target for all subsequent steps
  ```
- **Multiple repos (cross-repo graph)**:
  ```bash
  # Clone each repo, run the pipeline, then merge
  graphify clone <url1>   # → ~/.graphify/repos/<owner1>/<repo1>
  graphify clone <url2>   # → ~/.graphify/repos/<owner2>/<repo2>
  # Run /graphify on each local path to produce their graph.json files
  # Then merge:
  graphify merge-graphs \
    ~/.graphify/repos/<owner1>/<repo1>/graphify-out/graph.json \
    ~/.graphify/repos/<owner2>/<repo2>/graphify-out/graph.json \
    --out graphify-out/cross-repo-graph.json
  ```
  Clones are placed in `~/.graphify/repos/<owner>/<repo>`. Nodes in the merged graph carry a `repo` attribute.

### B. Multiple local subfolders (monorepo / multi-service)
Run the CLI directly inside subfolders to avoid clobbering the root `graphify-out/`:
```bash
graphify extract ./core/     # → ./core/graphify-out/graph.json
graphify extract ./service/  # → ./service/graphify-out/graph.json
graphify extract ./platform/ # → ./platform/graphify-out/graph.json
# Add --backend gemini|kimi|openai|deepseek|claude-cli depending on key

# Then merge at the project root:
graphify merge-graphs \
  ./core/graphify-out/graph.json \
  ./service/graphify-out/graph.json \
  ./platform/graphify-out/graph.json \
  --out graphify-out/graph.json
```

---

## 5. Git Commit Hooks & Native `CLAUDE.md` (`hooks.md`)

Loaded when installing hooks or wiring graphify into `CLAUDE.md`.

### A. Git Commit Hook
Install a post-commit hook to auto-rebuild on commit:
```bash
graphify hook install    # install
graphify hook uninstall  # remove
graphify hook status     # check
```
Appends to existing hooks if they exist. Runs AST extraction only on changed files (via `git diff HEAD~1`). Doc/image changes are ignored by hook.

### B. Native `CLAUDE.md` Integration
Runs once to keep graphify always-on in Claude Code sessions:
```bash
graphify claude install
graphify claude uninstall  # remove the section
```

---

## 6. Query, Path, Explain Traversal (`query.md`)

Two traversal modes (default BFS, or DFS via `--dfs` flag).

### A. Constrained Query Expansion (REQUIRED)
The CLI matches substring + IDF exactly (no stemming/synonyms). Expands the query vocabulary:
1. Extract token vocabulary:
```bash
$(cat graphify-out/.graphify_python) -c "
import json, re
from pathlib import Path
data = json.loads(Path('graphify-out/graph.json').read_text())
vocab = set()
for n in data['nodes']:
    for c in re.findall(r'[^\W\d_]+', n.get('label','') or '', re.UNICODE):
        parts = re.findall(r'[A-Z]+(?=[A-Z][a-z])|[A-Z]?[a-z]+|[A-Z]+', c) or [c]
        for p in parts:
            t = p.lower()
            if 3 <= len(t) <= 30:
                vocab.add(t)
Path('graphify-out/.vocab.txt').write_text('\n'.join(sorted(vocab)))
print(f'vocab: {len(vocab)} tokens')
"
```
2. Select up to 12 tokens from `graphify-out/.vocab.txt`.
3. Print expansion trace: `Query expanded to (from graph vocab, N tokens): [token1, token2, ...]`

### B. Run Query Traversal
```bash
graphify query "QUESTION"
```
Save Q&A result back to graph:
```bash
$(cat graphify-out/.graphify_python) -m graphify save-result --question "ORIGINAL_QUESTION" --answer "ANSWER" --type query --nodes NODE1 NODE2
```

### C. Path Traversal (`/graphify path`)
Finds shortest path between two named concepts:
```bash
graphify path "NODE_A" "NODE_B"
```
Save path result back:
```bash
$(cat graphify-out/.graphify_python) -m graphify save-result --question "Path from NODE_A to NODE_B" --answer "ANSWER" --type path_query --nodes NODE_A NODE_B
```

### D. Explain Traversal (`/graphify explain`)
Explain a single node and its connections:
```bash
graphify explain "NODE_NAME"
```
Save explanation back:
```bash
$(cat graphify-out/.graphify_python) -m graphify save-result --question "Explain NODE_NAME" --answer "ANSWER" --type explain --nodes NODE_NAME
```

---

## 7. Video & Audio Transcription (`transcribe.md`)

Loaded only when `detect` reports `video` files. Video/audio are transcribed to text, then treated as docs in Step 3.

**Whisper prompt curation**: Read top god node labels, compose a short domain hint, and run:
```bash
GRAPHIFY_WHISPER_MODEL=base
$(cat graphify-out/.graphify_python) -c "
import json, os
from pathlib import Path
from graphify.transcribe import transcribe_all

detect = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding=\"utf-8\"))
video_files = detect.get('files', {}).get('video', [])
prompt = os.environ.get('GRAPHIFY_WHISPER_PROMPT', 'Use proper punctuation and paragraph breaks.')

transcript_paths = transcribe_all(video_files, initial_prompt=prompt)
print(json.dumps(transcript_paths, ensure_ascii=False))
" > graphify-out/.graphify_transcripts.json
```
Read outputs and treat as docs list before semantic subagents in Step 3B. If `--whisper-model` is specified, set `GRAPHIFY_WHISPER_MODEL` accordingly.

---

## 8. Incremental Update & Cluster-only (`update.md`)

Loaded when `--update` or `--cluster-only` is passed.

### A. Incremental Update (`--update`)
1. Detect incremental changes:
```bash
$(cat graphify-out/.graphify_python) -c "
import sys, json
from graphify.detect import detect_incremental, save_manifest
from pathlib import Path

result = detect_incremental(Path('INPUT_PATH'))
new_total = result.get('new_total', 0)
print(json.dumps(result, indent=2, ensure_ascii=False))
Path('graphify-out/.graphify_incremental.json').write_text(json.dumps(result, ensure_ascii=False), encoding=\"utf-8\")
deleted = list(result.get('deleted_files', []))
if new_total == 0 and not deleted:
    print('No files changed since last run. Nothing to update.')
    raise SystemExit(0)
if deleted:
    print(f'{len(deleted)} deleted file(s) to prune.')
if new_total > 0:
    print(f'{new_total} new/changed file(s) to re-extract.')
"
```
2. Populate `.graphify_detect.json`:
```bash
$(cat graphify-out/.graphify_python) -c "
import json
from pathlib import Path
r = json.loads(Path('graphify-out/.graphify_incremental.json').read_text(encoding=\"utf-8\"))
Path('graphify-out/.graphify_detect.json').write_text(json.dumps({
    'files': r.get('new_files', {}),
    'all_files': r.get('files', {}),
    'total_files': r.get('new_total', 0),
    'total_words': r.get('total_words', 0),
    'skipped_sensitive': r.get('skipped_sensitive', []),
    'needs_graph': True,
}, ensure_ascii=False), encoding=\"utf-8\")
"
```
3. Check `code_only` changes:
```bash
$(cat graphify-out/.graphify_python) -c "
import json
from pathlib import Path

result = json.loads(open('graphify-out/.graphify_incremental.json', encoding='utf-8').read()) if Path('graphify-out/.graphify_incremental.json').exists() else {}
code_exts = {'.py','.ts','.js','.go','.rs','.java','.cpp','.c','.rb','.swift','.kt','.cs','.scala','.php','.cc','.cxx','.hpp','.h','.kts','.lua','.toc','.f','.F','.f90','.F90','.f95','.F95','.f03','.F03','.f08','.F08'}
new_files = result.get('new_files', {})
all_changed = [f for files in new_files.values() for f in files]
code_only = all(Path(f).suffix.lower() in code_exts for f in all_changed)
print('code_only:', code_only)
"
```
If `code_only` is `True`, run only Step 3A (AST) and skip Step 3B (no LLM subagents).
If `code_only` is `False`, run full Steps 3A–3C.

4. If only deletions occurred, initialize empty extraction:
```bash
if [ ! -f graphify-out/.graphify_extract.json ]; then
    $(cat graphify-out/.graphify_python) -c "
import json
from pathlib import Path
Path('graphify-out/.graphify_extract.json').write_text(json.dumps({'nodes':[],'edges':[],'hyperedges':[],'input_tokens':0,'output_tokens':0}), encoding='utf-8')
"
fi
```

5. Merge graphs:
```bash
$(cat graphify-out/.graphify_python) -c "
import json
from pathlib import Path
from graphify.build import build_merge
from graphify.detect import save_manifest

new_extraction = json.loads(Path('graphify-out/.graphify_extract.json').read_text(encoding=\"utf-8\"))
incremental = json.loads(Path('graphify-out/.graphify_incremental.json').read_text(encoding=\"utf-8\"))
deleted = list(incremental.get('deleted_files', []))
changed = [f for files in incremental.get('new_files', {}).values() for f in files]
prune = list(dict.fromkeys(deleted + changed)) or None

G = build_merge(
    [new_extraction],
    graph_path='graphify-out/graph.json',
    prune_sources=prune,
)
merged_out = {
    'nodes': [{'id': n, **d} for n, d in G.nodes(data=True)],
    'edges': [
        {**{k: val for k, val in d.items() if k not in ('_src', '_tgt', 'source', 'target')},
         'source': d.get('_src', u), 'target': d.get('_tgt', v)}
        for u, v, d in G.edges(data=True)
    ],
    'hyperedges': list(G.graph.get('hyperedges', [])),
    'input_tokens': new_extraction.get('input_tokens', 0),
    'output_tokens': new_extraction.get('output_tokens', 0),
}
Path('graphify-out/.graphify_extract.json').write_text(json.dumps(merged_out, ensure_ascii=False), encoding=\"utf-8\")
save_manifest(incremental['files'])
"
```

6. Compare graph diff:
```bash
$(cat graphify-out/.graphify_python) -c "
import json
from graphify.analyze import graph_diff
from graphify.build import build_from_json
from networkx.readwrite import json_graph
from pathlib import Path

old_data = json.loads(Path('graphify-out/.graphify_old.json').read_text(encoding=\"utf-8\")) if Path('graphify-out/.graphify_old.json').exists() else None
new_extract = json.loads(Path('graphify-out/.graphify_extract.json').read_text(encoding=\"utf-8\"))
G_new = build_from_json(new_extract)

if old_data:
    G_old = json_graph.node_link_graph(old_data, edges='links')
    diff = graph_diff(G_old, G_new)
    print(diff['summary'])
"
```

### B. Cluster-only Update (`--cluster-only`)
Re-runs clustering on the existing graph (skips Steps 1–3):
```bash
graphify cluster-only .
```
