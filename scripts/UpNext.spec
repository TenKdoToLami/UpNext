# -*- mode: python ; coding: utf-8 -*-
import os

block_cipher = None

a = Analysis(
    ['run.py'],
    pathex=['..'],
    binaries=[],
    datas=[
        ('../app/templates', 'app/templates'),
        ('../app/static', 'app/static'),
    ],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],

    excludes=['tkinter'] + (['PyQt6', 'PyQt6.QtWebEngine', 'PyQt6.QtWebEngineWidgets', 'webview', 'pystray'] if os.environ.get('UPNEXT_BUILD_SERVER') == '1' else []),
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# Toggle console based on server mode
is_server = os.environ.get('UPNEXT_BUILD_SERVER') == '1'

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='UpNext' + ('-server' if is_server else ''),
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False, # Disable UPX compression for faster builds
    upx_exclude=[],
    runtime_tmpdir=None,
    console=is_server, # Show console for server builds
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='../app/static/img/icon.ico'
)
