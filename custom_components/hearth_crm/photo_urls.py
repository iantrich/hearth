"""Signed photo URLs for the panel, cached so a large snapshot does not sign every photo again."""

from __future__ import annotations

from datetime import datetime, timedelta
from itertools import islice

from homeassistant.components.http.auth import async_sign_path
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

DATA_PHOTO_URLS = "hearth_crm_photo_urls"
URL_VALIDITY = timedelta(days=7)
RENEW_WHEN_LEFT = timedelta(days=1)
# At MAX_ENTRIES the oldest are dropped down to PRUNE_TO, so pruning runs once per few hundred
# new URLs rather than on every one.
MAX_ENTRIES = 5000
PRUNE_TO = 4500

type _Key = tuple[str, str, str]


def signed_photo_url(
    hass: HomeAssistant, refresh_token_id: str, owner_user_id: str, photo_hash: str
) -> str:
    """A signed URL for one photo, reused until less than a day of its validity is left."""
    cache: dict[_Key, tuple[str, datetime]] = hass.data.setdefault(DATA_PHOTO_URLS, {})
    now = dt_util.utcnow()
    key = (refresh_token_id, owner_user_id, photo_hash)
    cached = cache.get(key)
    if cached is not None and cached[1] - now > RENEW_WHEN_LEFT:
        return cached[0]
    if cached is not None:
        # Re-inserted below, so the dict's order stays signing order: oldest (and expired) first.
        del cache[key]
    if len(cache) >= MAX_ENTRIES:
        for oldest in list(islice(cache, len(cache) - PRUNE_TO)):
            del cache[oldest]
    url = async_sign_path(
        hass,
        f"/api/hearth_crm/photos/{owner_user_id}/{photo_hash}",
        URL_VALIDITY,
        refresh_token_id=refresh_token_id,
    )
    cache[key] = (url, now + URL_VALIDITY)
    return url
