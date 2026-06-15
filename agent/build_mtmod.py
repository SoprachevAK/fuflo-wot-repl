# -*- coding: utf-8 -*-
"""Compile the agent to py2.7 .pyc and package it as a bw_site .mtmod, optionally
installing into a WoT/Lesta client. RUN UNDER PYTHON 2.7:

    C:\\Python27\\python.exe agent/build_mtmod.py --game U:\\Programs\\Tanki

Produces a bw_site-injection package (early, PJOrion-style):

    meta.xml
    res/scripts/common/bw_site.pyc       (our loader, overrides the packaged one)
    res/scripts/common/wms_agent/*.pyc   (the agent package)

bw_site loads at site-init, hooks stdout/BigWorld.log before any game logs, then
defers to the original bw_site from res/packages/scripts.pkg.
"""

import os
import sys
import shutil
import zipfile
import py_compile
import argparse

HERE = os.path.dirname(os.path.abspath(__file__))
AGENT_PKG = os.path.join(HERE, 'wms_agent')
MTMOD_NAME = 'me.fuflo.wotrepl'

META = """<root>
    <id>me.fuflo.wotrepl</id>
    <name>Fuflo WoT REPL Agent</name>
    <description>Early bw_site REPL bridge for Fuflo WoT REPL (Python 2.7)</description>
    <version>%s</version>
</root>
"""


def _compile(src, dst):
    py_compile.compile(src, cfile=dst, doraise=True)


def build(out_dir, version):
    if sys.version_info[0] != 2:
        raise SystemExit('must run under Python 2.7 to emit py2.7 .pyc (got %s)'
                         % sys.version.split()[0])
    build_dir = os.path.join(out_dir, '_build')
    if os.path.exists(build_dir):
        shutil.rmtree(build_dir)
    common = os.path.join(build_dir, 'res', 'scripts', 'common')
    pkg_dir = os.path.join(common, 'wms_agent')
    os.makedirs(pkg_dir)

    _compile(os.path.join(HERE, 'bw_site.py'), os.path.join(common, 'bw_site.pyc'))
    for name in sorted(os.listdir(AGENT_PKG)):
        if name.endswith('.py'):
            _compile(os.path.join(AGENT_PKG, name), os.path.join(pkg_dir, name + 'c'))

    with open(os.path.join(build_dir, 'meta.xml'), 'w') as fh:
        fh.write(META % version)

    mtmod = os.path.join(out_dir, '%s_%s.mtmod' % (MTMOD_NAME, version))
    if os.path.exists(mtmod):
        os.remove(mtmod)
    # wotmod/mtmod packages must be STORED (uncompressed) zips.
    zf = zipfile.ZipFile(mtmod, 'w', zipfile.ZIP_STORED)
    try:
        for root, _dirs, files in os.walk(build_dir):
            for fn in files:
                ap = os.path.join(root, fn)
                arc = os.path.relpath(ap, build_dir).replace(os.sep, '/')
                zf.write(ap, arc)
    finally:
        zf.close()
    shutil.rmtree(build_dir)
    return mtmod


def install(mtmod, game_dir, mods_version):
    dest_dir = os.path.join(game_dir, 'mods', mods_version)
    if not os.path.isdir(dest_dir):
        os.makedirs(dest_dir)
    # Remove any previous build of ours (old gui.mods variant included).
    for fn in os.listdir(dest_dir):
        if fn.startswith('me.fuflo.wotrepl') or fn.startswith('me.wms.agent'):
            try:
                os.remove(os.path.join(dest_dir, fn))
            except OSError:
                pass
    dest = os.path.join(dest_dir, '%s.mtmod' % MTMOD_NAME)
    locked = False
    try:
        shutil.copy2(mtmod, dest)
    except (IOError, OSError):
        # Client is running and has the .mtmod loaded/locked. The build succeeded;
        # the new mod applies on the next client restart.
        locked = True
    base = os.environ.get('LOCALAPPDATA') or os.environ.get('APPDATA') or game_dir
    buffer_dir = os.path.join(base, 'FufloWoTREPL', 'buffer')
    if not os.path.isdir(buffer_dir):
        os.makedirs(buffer_dir)
    return dest, buffer_dir, locked


def main():
    parser = argparse.ArgumentParser(description='Build/install the Fuflo WoT REPL agent mod')
    parser.add_argument('--out', default=os.path.join(HERE, 'dist'))
    parser.add_argument('--version', default='0.1.0')
    parser.add_argument('--game', default=None, help='WoT client dir; if set, installs the mod')
    parser.add_argument('--mods-version', default='1.43.0.0', help='mods/<version> subfolder')
    args = parser.parse_args()

    if not os.path.isdir(args.out):
        os.makedirs(args.out)
    mtmod = build(args.out, args.version)
    print 'built:', mtmod
    if args.game:
        dest, buffer_dir, locked = install(mtmod, args.game, args.mods_version)
        if locked:
            print 'NOT installed (client running, file locked):', dest
            print 'Close the client and re-run, OR the new build applies on next restart.'
        else:
            print 'installed:', dest
        print 'buffer dir:', buffer_dir
        print 'Restart the client, then Connect in Fuflo WoT REPL to that buffer dir.'


if __name__ == '__main__':
    main()
