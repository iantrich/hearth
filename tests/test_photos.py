"""Tests for the content-addressed photo store."""

from __future__ import annotations

import hashlib
from pathlib import Path

import pytest

from custom_components.hearth_crm.photos import PhotoStore


def test_put_returns_sha256_and_writes_file(tmp_path: Path) -> None:
    store = PhotoStore(tmp_path / "photos")
    data = b"invented photo bytes"

    photo_hash = store.put(data)

    assert photo_hash == hashlib.sha256(data).hexdigest()
    assert (tmp_path / "photos" / photo_hash).read_bytes() == data
    assert store.exists(photo_hash)


def test_put_is_idempotent(tmp_path: Path) -> None:
    root = tmp_path / "photos"
    store = PhotoStore(root)
    data = b"same bytes twice"

    first = store.put(data)
    second = store.put(data)

    assert first == second
    assert [p.name for p in root.iterdir()] == [first]


def test_path_rejects_non_hex_hash(tmp_path: Path) -> None:
    store = PhotoStore(tmp_path / "photos")

    with pytest.raises(ValueError):
        store.path("../x")


def test_path_rejects_uppercase_or_wrong_length_hash(tmp_path: Path) -> None:
    store = PhotoStore(tmp_path / "photos")

    with pytest.raises(ValueError):
        store.path(hashlib.sha256(b"x").hexdigest().upper())
    with pytest.raises(ValueError):
        store.path("ab" * 31)


def test_exists_rejects_non_hex_hash(tmp_path: Path) -> None:
    store = PhotoStore(tmp_path / "photos")

    with pytest.raises(ValueError):
        store.exists("not-a-hash")


def test_init_does_not_create_root(tmp_path: Path) -> None:
    root = tmp_path / "photos"
    PhotoStore(root)

    assert not root.exists()


def test_put_creates_missing_root(tmp_path: Path) -> None:
    root = tmp_path / "nested" / "photos"
    store = PhotoStore(root)

    photo_hash = store.put(b"data")

    assert (root / photo_hash).is_file()


def test_failed_write_leaves_no_temp_file(tmp_path: Path, monkeypatch) -> None:
    root = tmp_path / "photos"
    store = PhotoStore(root)

    def boom(src, dst):
        raise OSError("disk full")

    monkeypatch.setattr("custom_components.hearth_crm.photos.os.replace", boom)

    with pytest.raises(OSError):
        store.put(b"data")

    assert list(root.iterdir()) == []
