"""Content-addressed photo storage: each photo is stored once, named by its sha256."""

from __future__ import annotations

import hashlib
import os
import re
import tempfile
from pathlib import Path

_HASH_RE = re.compile(r"[0-9a-f]{64}")


class PhotoStore:
    """Stores photo bytes under ``root/<sha256 hex>``. ``root`` is created on first write."""

    def __init__(self, root: Path) -> None:
        self._root = root

    def put(self, data: bytes) -> str:
        """Store ``data`` and return its sha256 hex digest. Writing the same bytes twice is a no-op."""
        photo_hash = hashlib.sha256(data).hexdigest()
        target = self.path(photo_hash)
        if target.is_file():
            return photo_hash

        self._root.mkdir(parents=True, exist_ok=True)
        fd, tmp_name = tempfile.mkstemp(dir=self._root)
        try:
            with os.fdopen(fd, "wb") as handle:
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(tmp_name, target)
        except BaseException:
            Path(tmp_name).unlink(missing_ok=True)
            raise
        return photo_hash

    def path(self, photo_hash: str) -> Path:
        """Return the file path for ``photo_hash``. Raises ValueError unless it is 64 lowercase hex chars."""
        _validate(photo_hash)
        return self._root / photo_hash

    def exists(self, photo_hash: str) -> bool:
        """Return whether a photo with ``photo_hash`` is stored. Raises ValueError for an invalid hash."""
        return self.path(photo_hash).is_file()


def _validate(photo_hash: str) -> None:
    if not _HASH_RE.fullmatch(photo_hash):
        raise ValueError(f"invalid photo hash: {photo_hash!r}")
