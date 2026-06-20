# Vowel Garden Notices

This project is released as a source-available Japanese learning app
preview for non-commercial use.

## Project License

Project code and release packages are licensed under the Vowel Garden
Non-Commercial Source License unless a file explicitly states otherwise.
Commercial use is prohibited without prior written permission.

## Bundled Assets

- Local UI font files are bundled with their upstream Open Font License
  notice in `assets/fonts/` and the generated Android public assets.
- Word visual cards are project-generated SVG learning assets.
- Japanese reading audio is bundled as local WAV files for offline playback.
- Handwriting stroke data and stroke animation resources are included for
  learning validation and review.
- Kanji handwriting models in `src/data/kanjiHandwritingModels.js` are
  derived from KanjiVG SVG stroke path data. KanjiVG is copyright Ulrich
  Apel / KanjiVG contributors and is distributed under Creative Commons
  Attribution-Share Alike 3.0. Project links:
  https://github.com/KanjiVG/kanjivg and https://kanjivg.tagaini.net/.
  The raw KanjiVG SVG files are not bundled; generated stroke point models
  are bundled for handwriting validation.

## Release Scope

The current release package is a non-commercial preview build for testing
and manual acceptance. It is not marked as a final stable course release.

Before publishing to a public app store, using the package in a paid
product or service, or redistributing it outside the non-commercial preview
scope, re-check the redistribution terms for bundled audio, stroke
animations, fonts, and visual assets.
