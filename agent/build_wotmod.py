#!/usr/bin/env python3
"""Render the bw_site loader and zip the agent for injection.

This is a desktop-side helper (runs on Python 3). It produces:
    <out>/agent.zip     importable package (zipimport) containing wms_agent/
    <out>/bw_site.py    loader with AGENT_PATH/BUFFER_DIR filled in

The desktop app (or the user) then drops bw_site.py into the client's
scripts/common/ and points the game at agent.zip. The buffer dir is the shared
folder both sides use for the file-buffer channel.
"""

import argparse
import os
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))


def build_agent_zip(out_dir):
    zip_path = os.path.join(out_dir, "agent.zip")
    pkg_root = os.path.join(HERE, "wms_agent")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _dirs, files in os.walk(pkg_root):
            for name in files:
                if not name.endswith(".py"):
                    continue
                abs_path = os.path.join(root, name)
                arc = os.path.relpath(abs_path, HERE)
                zf.write(abs_path, arc.replace(os.sep, "/"))
    return zip_path


def render_loader(out_dir, agent_path, buffer_dir):
    template = open(os.path.join(HERE, "bw_site.py.tmpl"), "r", encoding="utf-8").read()
    rendered = template.replace("$AGENT_PATH$", agent_path).replace(
        "$BUFFER_DIR$", buffer_dir
    )
    dest = os.path.join(out_dir, "bw_site.py")
    with open(dest, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(rendered)
    return dest


def main():
    parser = argparse.ArgumentParser(description="Build the WoT Mod Studio agent payload")
    parser.add_argument("--out", required=True, help="output directory")
    parser.add_argument("--buffer-dir", required=True, help="shared file-buffer directory")
    parser.add_argument(
        "--agent-path",
        default=None,
        help="path the loader adds to sys.path (defaults to <out>/agent.zip)",
    )
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)
    zip_path = build_agent_zip(args.out)
    agent_path = args.agent_path or zip_path
    loader = render_loader(args.out, agent_path, args.buffer_dir)
    print("agent zip:", zip_path)
    print("bw_site  :", loader)


if __name__ == "__main__":
    main()
