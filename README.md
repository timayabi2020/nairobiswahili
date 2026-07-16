# Nairobi Swahili

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