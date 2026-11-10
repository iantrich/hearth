---
layout: default
title: Privacy Policy
---

# Hearth privacy policy

*Last updated: November 9, 2026*

Hearth is open-source software that you install and run on your own Home Assistant. This policy explains what happens to your data when you use it.

## Who is responsible

The developer of Hearth does not operate any server or service for it. There is no Hearth account, no sign-up, no analytics, no telemetry and no advertising. The developer does not receive, store or have access to your data. You are the only controller of what you put in your CRM.

## Where your data lives

Everything you enter (people, contact details, birthdays, notes, relationships, interactions and photos) is stored in your own Home Assistant configuration directory, on the hardware you control. It is separated per Home Assistant user. Backing it up, securing it and deleting it are up to you, and it is covered by your Home Assistant's own protections.

## Google Contacts (optional)

Google Contacts sync is off by default. If you connect it:

- Hearth uses Google's sign-in (OAuth) to ask for two permissions: access to your Google Contacts (`https://www.googleapis.com/auth/contacts`), and the basic `openid` sign-in. The second gives Hearth only an anonymous account id, used to tell which Google account is connected and to refuse a different one by mistake. Hearth does not receive your name, email address or profile photo.
- Hearth sends names, phone numbers, email addresses, postal addresses and photos from your CRM to your own Google account through the Google People API, and reads back only the contact id and version marker it needs to update a contact safely.
- The sign-in tokens are stored in your Home Assistant. They are not sent anywhere except to Google.
- Data goes directly from your Home Assistant to Google. It does not pass through any server run by the developer.
- Hearth never deletes contacts in Google. It only changes contacts it has a stored link to, and it never matches your existing Google contacts by name, phone or email.

You can stop at any time by switching the sync off or removing the connection in Home Assistant, and you can revoke Hearth's access at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).

### Google API Services User Data Policy

Hearth's use and transfer of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements. Google user data is used only to provide the sync you asked for. It is not used for advertising, is not sold, is not shared with anyone, and is not used to train AI or machine-learning models.

## Claude (optional)

If you choose to connect an AI assistant such as Claude to your Home Assistant's MCP server, the assistant can read and edit your CRM through the tools Hearth exposes. What it can see is governed by your own Home Assistant setup and by the assistant's provider, whose privacy policy applies to that use. Hearth does not send your data to any assistant on its own.

## What Hearth does not do

- It does not send your data to the developer or to any third party, other than Google when you turn the Google sync on.
- It does not include trackers, analytics or advertising.
- It does not sell or share personal information.

## Other people's information

Your CRM holds information about other people. Please use it responsibly and in line with the laws that apply to you.

## Changes

If this policy changes, the new version will be published on this page with a new date.

## Contact

Questions or concerns: [open an issue](https://github.com/iantrich/hearth/issues) on the Hearth repository.
