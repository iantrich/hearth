"""Tests for the cached signed photo URLs."""

from __future__ import annotations

from datetime import timedelta

from custom_components.hearth_crm import photo_urls
from custom_components.hearth_crm.photo_urls import signed_photo_url


async def test_photo_urls_reused_then_renewed(hass, freezer):
    url1 = signed_photo_url(hass, "rt1", "owner1", "a" * 64)
    assert url1.startswith(f"/api/hearth_crm/photos/owner1/{'a' * 64}?authSig=")
    freezer.tick(timedelta(days=5))
    assert signed_photo_url(hass, "rt1", "owner1", "a" * 64) == url1
    freezer.tick(timedelta(days=1, seconds=1))  # under 1 day of validity left
    assert signed_photo_url(hass, "rt1", "owner1", "a" * 64) != url1


async def test_photo_urls_differ_per_refresh_token(hass):
    assert signed_photo_url(hass, "rt1", "o", "b" * 64) != signed_photo_url(hass, "rt2", "o", "b" * 64)


async def test_photo_url_cache_drops_oldest_when_full(hass, monkeypatch, freezer):
    monkeypatch.setattr(photo_urls, "MAX_ENTRIES", 4)
    monkeypatch.setattr(photo_urls, "PRUNE_TO", 2)
    hashes = [str(i) * 64 for i in range(6)]
    urls = {}
    for h in hashes[:4]:
        urls[h] = signed_photo_url(hass, "rt1", "o", h)
        freezer.tick(timedelta(seconds=1))
    cache = hass.data[photo_urls.DATA_PHOTO_URLS]
    assert len(cache) == 4
    # Full: the next miss keeps only the newest two, then adds itself.
    signed_photo_url(hass, "rt1", "o", hashes[4])
    assert [key[2] for key in cache] == [hashes[2], hashes[3], hashes[4]]
    # The kept ones are still reused.
    assert signed_photo_url(hass, "rt1", "o", hashes[3]) == urls[hashes[3]]
    assert len(cache) == 3


async def test_photo_url_renewal_counts_as_newest(hass, monkeypatch, freezer):
    monkeypatch.setattr(photo_urls, "MAX_ENTRIES", 3)
    monkeypatch.setattr(photo_urls, "PRUNE_TO", 2)
    signed_photo_url(hass, "rt1", "o", "a" * 64)
    freezer.tick(timedelta(days=3))
    signed_photo_url(hass, "rt1", "o", "b" * 64)
    freezer.tick(timedelta(days=3, seconds=1))  # "a" has under a day left, so it is renewed
    signed_photo_url(hass, "rt1", "o", "a" * 64)
    signed_photo_url(hass, "rt1", "o", "c" * 64)
    signed_photo_url(hass, "rt1", "o", "d" * 64)  # full: "b" is now the oldest and goes
    cache = hass.data[photo_urls.DATA_PHOTO_URLS]
    assert [key[2] for key in cache] == ["a" * 64, "c" * 64, "d" * 64]
