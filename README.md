# mania-difficalc

A static site for prototyping osu!mania star rating changes.

## Dependencies

- node.js v12
- npm 6

## Setup

Run `npm install`  in the project directory`.
Create a `data` folder for maps to be calculated.
Create a subfolder for each grouping of maps, and copy the .osu files into them.

e.g. `data/ranked-4k/artist - title (mapper) [diff].osu`

Only folders specified in `index.js` are used.

## Usage

Run `npm build` to generate the web interface. You can use `npm run watch` to watch for changes.

The output will be placed in the `dist` folder. If you have python 3, you can use `python -m http.server` in the dist folder to view the site locally.

Run `npm run calc` to compute new difficulties for maps in the data folder. These are saved in `dist/data`.

Run `npm run deploy` to deploy to GitHub Pages.

