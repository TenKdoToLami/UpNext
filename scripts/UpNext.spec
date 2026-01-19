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

    excludes=['tkinter'] + (['PyQt6', 'PyQt6.QtWebEngine', 'PyQt6.QtWebEngineWidgets', 'PyQt5'] if os.name == 'nt' else []),
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='UpNext',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False, # Disable UPX compression for faster builds
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='../app/static/img/icon.ico'
)
