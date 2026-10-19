// SVG textures for the bundled sample models. Most parts are drawn in model canvas
// coordinates (the viewBox is the layer rect), so positions match model.json directly.

const MIRROR_AROUND_CENTER = 'transform="matrix(-1 0 0 1 1024 0)"';

function svg_in_canvas(x, y, width, height, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}">\n${body}\n</svg>\n`;
}

function linear_gradient(id, top_color, bottom_color) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top_color}"/><stop offset="1" stop-color="${bottom_color}"/></linearGradient>`;
}

const HAIR_BACK_PATHS = {
  long: "M 512 175 C 330 175 262 330 270 520 C 276 650 262 760 300 806 L 724 806 C 762 760 748 650 754 520 C 762 330 694 175 512 175 Z",
  bob: "M 512 175 C 330 175 268 320 274 470 C 278 560 296 622 330 656 L 694 656 C 728 622 746 560 750 470 C 756 320 694 175 512 175 Z",
};

const BANGS_PATHS = {
  spiky:
    "M 330 440 C 318 300 400 192 512 192 C 624 192 706 300 694 440 L 664 380 L 642 456 L 602 362 L 562 444 L 532 352 L 492 452 L 462 352 L 422 444 L 392 370 L 362 456 Z",
  straight:
    "M 330 440 C 318 300 400 192 512 192 C 624 192 706 300 694 440 C 680 430 668 428 652 430 L 646 410 L 630 432 " +
    "C 600 428 580 428 560 432 L 552 408 L 540 434 C 520 432 504 432 484 434 L 472 408 L 464 434 " +
    "C 440 430 420 430 396 432 L 386 410 L 376 436 C 360 432 346 434 330 440 Z",
};

const EYE_WHITE_PATH =
  "M 400 500 C 400 476 420 470 440 470 C 460 470 480 476 480 500 C 480 524 460 530 440 530 C 420 530 400 524 400 500 Z";

/** Returns { "<file name>.svg": "<svg ...>" } for one model. */
export function build_sample_model_textures(palette, features) {
  const textures = {};
  const iris =
    `<defs><radialGradient id="iris" cx="0.5" cy="0.6" r="0.6"><stop offset="0" stop-color="${palette.iris[0]}"/>` +
    `<stop offset="0.55" stop-color="${palette.iris[1]}"/><stop offset="1" stop-color="${palette.iris[2]}"/></radialGradient></defs>\n` +
    `  <ellipse cx="440" cy="500" rx="21" ry="26" fill="url(#iris)"/><ellipse cx="440" cy="502" rx="9" ry="12" fill="#10120F"/>` +
    `<circle cx="447" cy="489" r="5" fill="#FFFFFF"/>`;
  const lash =
    `<path d="M 396 484 C 410 462 468 456 486 474" fill="none" stroke="${palette.lash}" stroke-width="7" stroke-linecap="round"/>` +
    `<path d="M 396 484 L 392 476" stroke="${palette.lash}" stroke-width="5" stroke-linecap="round"/>`;
  const closed_eye = `<path d="M 404 500 C 420 514 460 514 476 500" fill="none" stroke="${palette.lash}" stroke-width="6" stroke-linecap="round"/>`;
  const brow = `<path d="M 402 438 C 420 426 456 424 478 432" fill="none" stroke="${palette.brow}" stroke-width="7" stroke-linecap="round"/>`;
  const mouth_line = (path) => `  <path d="${path}" fill="none" stroke="${palette.mouth_line}" stroke-width="4" stroke-linecap="round"/>`;

  textures["hair_back.svg"] = svg_in_canvas(262, 170, 500, 640,
    `  <defs>${linear_gradient("hair", ...palette.hair_back)}</defs>\n  <path d="${HAIR_BACK_PATHS[features.hair_style]}" fill="url(#hair)"/>`);

  textures["body.svg"] = svg_in_canvas(232, 620, 560, 404, [
    `  <defs>\n    ${linear_gradient("hoodie", ...palette.hoodie)}\n    ${linear_gradient("neck", ...palette.neck)}\n  </defs>`,
    '  <path d="M 478 630 L 546 630 L 554 750 L 470 750 Z" fill="url(#neck)"/>',
    '  <path d="M 262 1024 C 262 860 330 762 470 732 C 490 768 534 768 554 732 C 694 762 762 860 762 1024 Z" fill="url(#hoodie)"/>',
    `  <path d="M 470 732 C 490 768 534 768 554 732" fill="none" stroke="${palette.collar}" stroke-width="6"/>`,
    `  <path d="M 488 762 L 480 860" stroke="${palette.strings}" stroke-width="6" stroke-linecap="round"/>`,
    `  <path d="M 536 762 L 544 860" stroke="${palette.strings}" stroke-width="6" stroke-linecap="round"/>`,
    `  <circle cx="480" cy="866" r="7" fill="${palette.strings}"/><circle cx="544" cy="866" r="7" fill="${palette.strings}"/>`,
  ].join("\n"));

  textures["face.svg"] = svg_in_canvas(332, 270, 360, 420, [
    `  <defs><radialGradient id="skin" cx="0.5" cy="0.45" r="0.6"><stop offset="0.7" stop-color="${palette.skin[0]}"/><stop offset="1" stop-color="${palette.skin[1]}"/></radialGradient></defs>`,
    '  <path d="M 512 676 C 440 676 360 610 345 500 C 335 400 400 285 512 285 C 624 285 689 400 679 500 C 664 610 584 676 512 676 Z" fill="url(#skin)"/>',
  ].join("\n"));

  textures["blush.svg"] = svg_in_canvas(386, 552, 252, 40, [
    `  <defs><radialGradient id="blush"><stop offset="0" stop-color="${palette.blush}" stop-opacity="0.65"/><stop offset="1" stop-color="${palette.blush}" stop-opacity="0"/></radialGradient></defs>`,
    '  <ellipse cx="430" cy="572" rx="40" ry="16" fill="url(#blush)"/><ellipse cx="594" cy="572" rx="40" ry="16" fill="url(#blush)"/>',
  ].join("\n"));

  textures["nose.svg"] = svg_in_canvas(504, 548, 16, 12, `  <path d="M 508 557 L 515 554" stroke="${palette.nose}" stroke-width="3" stroke-linecap="round"/>`);

  textures["mouth_open.svg"] = svg_in_canvas(482, 588, 60, 44, [
    `  <path d="M 486 592 C 500 596 524 596 538 592 C 536 616 524 628 512 628 C 500 628 488 616 486 592 Z" fill="${palette.mouth_inner}"/>`,
    `  <ellipse cx="512" cy="621" rx="13" ry="6" fill="${palette.tongue}"/>`,
  ].join("\n"));
  textures["mouth_neutral.svg"] = svg_in_canvas(472, 580, 80, 28, mouth_line("M 492 592 C 504 596 520 596 532 592"));
  textures["mouth_smile.svg"] = svg_in_canvas(472, 580, 80, 28, mouth_line("M 484 586 C 498 604 526 604 540 586"));
  textures["mouth_frown.svg"] = svg_in_canvas(472, 580, 80, 28, mouth_line("M 488 602 C 500 590 524 590 536 602"));

  // Left parts are drawn in place; right parts are mirrored around x = 512, or shifted for the iris.
  const part = (x, y, width, height, body, group_attributes = "") => svg_in_canvas(x, y, width, height, `  <g ${group_attributes}>${body}</g>`);
  textures["eye_white_left.svg"] = part(398, 468, 84, 64, `<path d="${EYE_WHITE_PATH}" fill="#FFFFFF"/>`);
  textures["eye_white_right.svg"] = part(542, 468, 84, 64, `<path d="${EYE_WHITE_PATH}" fill="#FFFFFF"/>`, MIRROR_AROUND_CENTER);
  textures["iris_left.svg"] = part(417, 472, 46, 56, iris);
  textures["iris_right.svg"] = part(561, 472, 46, 56, iris, 'transform="translate(144 0)"');
  textures["lash_left.svg"] = part(390, 456, 100, 32, lash);
  textures["lash_right.svg"] = part(534, 456, 100, 32, lash, MIRROR_AROUND_CENTER);
  textures["eye_closed_left.svg"] = part(400, 492, 80, 24, closed_eye);
  textures["eye_closed_right.svg"] = part(544, 492, 80, 24, closed_eye, MIRROR_AROUND_CENTER);
  textures["brow_left.svg"] = part(396, 420, 88, 24, brow);
  textures["brow_right.svg"] = part(540, 420, 88, 24, brow, MIRROR_AROUND_CENTER);

  textures["hair_front.svg"] = svg_in_canvas(300, 180, 424, 300, [
    `  <defs>${linear_gradient("bangs", ...palette.bangs)}</defs>`,
    `  <path d="${BANGS_PATHS[features.bangs_style]}" fill="url(#bangs)"/>`,
    '  <path d="M 420 236 C 460 214 520 210 560 222" fill="none" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="8" stroke-linecap="round"/>',
    `  <path d="M 600 250 C 630 270 650 300 660 330" fill="none" stroke="${palette.accent}" stroke-opacity="0.8" stroke-width="6" stroke-linecap="round"/>`,
  ].join("\n"));

  if (features.has_cat_ears) {
    const ear =
      '<path d="M 352 272 L 376 128 L 474 214 Z" fill="url(#ear)"/>' +
      `<path d="M 374 246 L 388 168 L 446 216 Z" fill="${palette.ear_inner}"/>`;
    textures["cat_ears.svg"] = svg_in_canvas(300, 120, 424, 160, [
      `  <defs>${linear_gradient("ear", ...palette.bangs)}</defs>`,
      `  <g>${ear}</g>`,
      `  <g ${MIRROR_AROUND_CENTER}>${ear}</g>`,
    ].join("\n"));
  }

  return textures;
}
