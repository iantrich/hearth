"""Register Hearth's sidebar panel and serve its JavaScript."""

from __future__ import annotations

import inspect
import json
import logging
from pathlib import Path

from homeassistant.components import panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

from .const import PANEL_ELEMENT, PANEL_MODULE, PANEL_URL_PATH, STATIC_URL

_LOGGER = logging.getLogger(__name__)
_REGISTERED = "hearth_crm_panel"
_HERE = Path(__file__).parent


async def async_register_panel(hass: HomeAssistant) -> None:
    """Serve the panel files and add the sidebar entry; does nothing if already done."""
    if hass.data.get(_REGISTERED):
        return
    manifest = await hass.async_add_executor_job((_HERE / "manifest.json").read_text, "utf-8")
    version = json.loads(manifest)["version"]
    await hass.http.async_register_static_paths(
        [StaticPathConfig(STATIC_URL, str(_HERE / "www"), cache_headers=False)]
    )
    extra = {}
    if "handle_safe_area" in inspect.signature(panel_custom.async_register_panel).parameters:
        extra["handle_safe_area"] = True
    try:
        await panel_custom.async_register_panel(
            hass,
            webcomponent_name=PANEL_ELEMENT,
            frontend_url_path=PANEL_URL_PATH,
            sidebar_title="Hearth",
            sidebar_icon="mdi:fireplace",
            module_url=f"{STATIC_URL}/{PANEL_MODULE}?v={version}",
            embed_iframe=False,
            require_admin=False,
            **extra,
        )
    except ValueError:
        _LOGGER.warning("The /%s panel URL is already taken; not registering Hearth's", PANEL_URL_PATH)
    hass.data[_REGISTERED] = True
