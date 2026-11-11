---
layout: default
title: Hearth
---

# Hearth

Hearth is a personal CRM for people you care about: who they are, how you know them, when their birthdays are, and when you last caught up. It runs inside your own [Home Assistant](https://www.home-assistant.io/) as a custom integration, so your data stays on your own hardware.

## What it does

- **People, households, groups, relationships and interactions**, with a sidebar panel in Home Assistant for browsing and editing.
- **One CRM per Home Assistant user**, each with its own database and photos.
- **Reminders** to follow up with someone at a set time, once or repeating, delivered as a phone notification.
- **Works with Claude** through Home Assistant's MCP server, so you can ask who to reach out to or log a catch-up in plain language.
- **Optional Google Contacts sync.** Hearth can keep a copy of your contacts up to date in your own Google account. It is one-way (Hearth to Google), off by default, and never deletes anything in Google.
- **Portable.** Import and export your whole CRM as a bundle file.

## Your data stays with you

Hearth has no servers and no accounts. Nothing is sent to the developer. The only data that ever leaves your Home Assistant is what you choose to sync to your own Google account. Read the [privacy policy]({{ site.baseurl }}/privacy).

## Install

Hearth installs through [HACS](https://hacs.xyz/). Add `https://github.com/iantrich/hearth` as a custom repository of type **Integration**, download Hearth, restart Home Assistant, then add the integration from **Settings > Devices & services**. The full guide, including Google Contacts setup, is in the [README](https://github.com/iantrich/hearth#readme).

## Links

- [Source code and documentation](https://github.com/iantrich/hearth)
- [Report a problem or ask a question](https://github.com/iantrich/hearth/issues)
- [Privacy policy]({{ site.baseurl }}/privacy)
- [Terms of service]({{ site.baseurl }}/terms)

Hearth is open-source software released under the MIT license. It is an independent project and is not affiliated with or endorsed by Home Assistant, Nabu Casa, Google or Anthropic.
