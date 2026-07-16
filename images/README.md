# Images folder

Place your local website images in this folder.

Suggested filenames used by `site-content.json`:

- `about-me.jpg`
- `about-swahili.jpg`
- `dunia-tech.jpg`
- `dunia-climate.jpg`
- `dunia-culture.jpg`
- `testimonial-sophie.jpg`

About Me photo provision:

- Set `aboutMe.image.src` in `site-content.json` to your portrait path, for example `./images/about-me.jpg`.
- Set `aboutMe.image.alt` for accessibility.
- Set `aboutMe.photoCaption` for the text under the photo.

You can also use your own names and update the `src` fields in `site-content.json`.

Examples of valid image paths in JSON:

- `"./images/my-photo.jpg"` (local project image)
- `"https://example.com/photo.jpg"` (external image URL)
