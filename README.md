# Nairobi Swahili

## Lesson Enquiries (GitHub Pages + Gmail)

Every lesson's Enroll button opens a responsive, keyboard-accessible popup with
the selected lesson, name, phone, email, optional preferred start date and
questions/suggestions. Consent is required; this is an enquiry, not a booking.

GitHub Pages cannot run SMTP. Instead, a small Google Apps Script web app sends
email through your authorized Google account using `MailApp`. This uses Gmail
without an SMTP password, server hosting bill, or secrets in this repository.
Google processes the submitted details and stores the delivered email in your
mailbox; do not collect payment or sensitive information through this form.

### One-time private setup

1. Sign into the Google account that should send enquiries, then create a project
   at [Google Apps Script](https://script.google.com/).
2. Replace its default code with [`google-apps-script/Code.gs`](google-apps-script/Code.gs).
3. In **Project Settings > Script properties**, add:
   - `ENROLLMENT_EMAIL`: the inbox receiving enquiries, e.g. `nbo.swahili@gmail.com`.
   - `SITE_ORIGIN`: `https://nairobiswahili.com` (exact origin, no trailing slash).
     If hosting under a GitHub Pages URL instead, use `https://USERNAME.github.io`,
     without a repository path. The popup must be visited at this exact origin
     to receive delivery confirmations.
4. Choose **Deploy > New deployment > Web app**. Set **Execute as: Me** and
   **Who has access: Anyone** (including signed-out visitors), then authorize
   sending mail. Some Workspace administrators disallow anonymous web apps; use
   an account that permits them.
5. Copy the deployed `/exec` URL, not the editor or `/dev` URL, into `endpoint` in
   [`enrollment-config.json`](enrollment-config.json). Commit that public URL.
   Never commit Google passwords, app passwords, OAuth tokens or private settings.
6. Publish the site and submit a test enquiry while signed out of Google.
   Confirm the success message, inbox delivery, selected lesson, every field and
   that **Reply** addresses the visitor. Check spam as well. This live step is
   required: local tests cannot verify your Google authorization or deployment.
7. After changing Apps Script code, use **Deploy > Manage deployments > Edit >
   New version > Deploy** so the existing URL uses the updated code.

Until configured, the popup explicitly directs visitors to email or phone rather
than pretending to send. Delivery uses a hidden form/iframe and a request-matched
Google `postMessage` acknowledgement; it does not treat an opaque `no-cors`
response as success. Success means Google's mail service accepted the message,
not guaranteed inbox delivery. A 45-second timeout warns that delivery is
unconfirmed and asks visitors to contact you before retrying.

The public endpoint is not a secret or authentication boundary. Server validation,
a honeypot, a fixed recipient, short-lived duplicate suppression and per-address
limits reduce abuse. The script caps sends at 80/day and also checks Google's
remaining mail quota. Limits may need adjusting for your account; Apps Script
cache limits are best-effort, not a replacement for CAPTCHA or a dedicated
rate-limited backend if abuse occurs. CORS/origin checks alone cannot stop spam.
Contact details are not stored in browser storage or script properties; temporary
rate-limit keys contain a hash of the email address. Retain inbox enquiries only
as long as needed and restrict access to your Google account.

Run backend and frontend contract tests with:

```sh
node --test tests/enrollment.test.cjs
```

This site now loads meetup events from `meetups.json` so you do not need to edit `index.html` to update upcoming events.
It also loads the lessons section heading, intro, and lesson cards from `lessons.json`.
It now also loads template sections (About, Programs, Dunia Wiki Hii, Calendar, Testimonials, Contacts) from `site-content.json`.

## Update Template Sections (No Coding Needed)

1. Open `site-content.json`.
2. Edit section text under keys like `aboutMe`, `aboutSwahili`, `programs`, `dunia`, `calendar`, `testimonials`, and `contacts`.
3. Save and commit.

### Important fields

- `sectionLabel`: bilingual mini heading
- `title`: main bilingual heading
- `intro`: section paragraph
- `items` / `cards`: list content for cards
- `points`: bullet content for About sections

## Image Provision

The website supports images from:

1. Local project images in `images/`
2. Remote image URLs (for example, CDN links)

To use local images:

1. Add files to `images/`.
2. Set image paths in `site-content.json` using `./images/filename.jpg`.

### Image JSON structure examples

For single section image:

```json
"image": {
	"src": "./images/about-me.jpg",
	"alt": "About me photo"
}
```

For item card image:

```json
"image": {
	"src": "./images/dunia-tech.jpg",
	"alt": "Technology story image"
}
```

See `images/README.md` for suggested filenames.

## Update Meetups (No Coding Needed)

1. Open `meetups.json` in GitHub (or VS Code).
2. Find the `"meetups"` list.
3. Copy an existing meetup object and edit the values.
4. Keep the same field names: `date`, `title`, `location`, `time`, `cost`, `tags`.
5. Save and commit the file.

### Example meetup object

```json
{
	"date": "2026-09-06",
	"title": "Swahili Storytelling Night",
	"location": "Alliance Francaise, Nairobi",
	"time": "5:30 PM – 8:00 PM",
	"cost": "KES 300",
	"tags": ["Stories", "Community", "All Levels"]
}
```

### Date format

- Use `YYYY-MM-DD` (for example: `2026-09-06`).

### Tips

- Keep commas exactly like in other items.
- `tags` must be inside square brackets and each tag in quotes.
- If `meetups.json` has an error, the site will show built-in fallback meetups.

## Update Lessons (No Coding Needed)

1. Open `lessons.json` in GitHub.
2. Edit `title` to change text like "Learn at Your Own Pace".
3. Edit `intro` for the subtitle line.
4. Add or update lesson cards under `items`.
5. Save and commit.

### Lesson fields

- `levelClass`: `beginner`, `intermediate`, or `advanced`
- `level`: label shown on card (for example: `Kids`)
- `title`: lesson name
- `description`: short summary
- `schedule`: date/time text
- `duration`: class length text
- `ctaText`: button text