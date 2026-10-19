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
  // Big clumps behind the face; their tips peek out between the front clumps.
  short:
    "M 512 640 L 380 620 L 372 572 L 336 600 L 340 540 L 304 556 Q 316 500 300 450 Q 280 400 290 340 Q 300 380 318 372 " +
    "Q 300 300 330 240 Q 344 280 360 280 Q 370 210 430 178 Q 432 210 444 214 Q 500 170 580 178 Q 640 190 680 230 " +
    "Q 726 280 730 360 Q 744 420 720 470 L 724 556 L 684 540 L 688 600 L 652 572 L 644 620 Z",
};

const BANGS_PATHS = {
  spiky:
    "M 330 440 C 318 300 400 192 512 192 C 624 192 706 300 694 440 L 664 380 L 642 456 L 602 362 L 562 444 L 532 352 L 492 452 L 462 352 L 422 444 L 392 370 L 362 456 Z",
  straight:
    "M 330 440 C 318 300 400 192 512 192 C 624 192 706 300 694 440 C 680 430 668 428 652 430 L 646 410 L 630 432 " +
    "C 600 428 580 428 560 432 L 552 408 L 540 434 C 520 432 504 432 484 434 L 472 408 L 464 434 " +
    "C 440 430 420 430 396 432 L 386 410 L 376 436 C 360 432 346 434 330 440 Z",
  // Clumps sweep toward the viewer's left (short steep edge, long curved back), side locks reach the cheeks.
  swept:
    "M 338 556 Q 312 470 314 400 Q 296 368 302 320 Q 316 318 346 330 Q 326 290 326 246 Q 352 240 392 266 Q 380 226 390 190 " +
    "Q 420 186 466 226 Q 470 206 480 186 Q 520 180 556 214 Q 560 200 574 186 Q 616 190 640 236 Q 650 222 668 214 " +
    "Q 700 230 700 286 Q 712 284 724 300 Q 728 360 708 400 C 712 440 706 480 692 528 " +
    "Q 680 466 664 420 Q 650 438 618 448 Q 630 426 610 400 Q 596 438 560 452 Q 572 426 556 398 Q 540 452 498 484 " +
    "Q 510 430 500 398 Q 482 438 440 450 Q 452 424 444 398 Q 424 436 392 446 Q 400 424 396 400 Q 370 428 364 470 Q 352 512 338 556 Z",
};

/** Face outlines: soft (round cheeks) and defined (a firmer jaw for male faces). */
const FACE_PATHS = {
  soft: "M 512 676 C 440 676 360 610 345 500 C 335 400 400 285 512 285 C 624 285 689 400 679 500 C 664 610 584 676 512 676 Z",
  defined:
    "M 512 676 C 472 676 404 630 370 574 C 352 544 344 514 345 490 C 340 390 404 285 512 285 C 620 285 684 390 679 490 " +
    "C 680 514 672 544 654 574 C 620 630 552 676 512 676 Z",
};

/** Left-eye shapes in canvas coordinates; the right eye mirrors them. Narrow eyes read as sharper, more male. */
const EYE_SHAPES = {
  round: {
    white: "M 400 500 C 400 476 420 470 440 470 C 460 470 480 476 480 500 C 480 524 460 530 440 530 C 420 530 400 524 400 500 Z",
    iris_radii: [21, 26],
    lash: "M 396 484 C 410 462 468 456 486 474",
    has_lash_flick: true,
    closed: "M 404 500 C 420 514 460 514 476 500",
  },
  narrow: {
    white: "M 400 500 C 414 482 446 474 470 482 C 478 486 482 496 482 506 C 466 518 446 524 428 520 C 414 516 404 508 400 500 Z",
    iris_radii: [18, 23],
    lash: "M 394 498 C 410 478 448 466 486 484",
    has_lash_flick: false,
    closed: "M 404 504 C 424 512 458 512 478 502",
  },
};

const BROW_SHAPES = {
  curved: (color) => `<path d="M 402 438 C 420 426 456 424 478 432" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/>`,
  straight: (color) => `<path d="M 400 440 C 420 428 456 424 482 429 L 482 436 C 456 433 422 437 402 446 Z" fill="${color}"/>`,
};

/** Returns { "<file name>.svg": "<svg ...>" } for one model. */
export function build_sample_model_textures(palette, features) {
  const textures = {};
  const eye_shape = EYE_SHAPES[features.eye_style ?? "round"];
  const [iris_radius_x, iris_radius_y] = eye_shape.iris_radii;
  const iris =
    `<defs><radialGradient id="iris" cx="0.5" cy="0.6" r="0.6"><stop offset="0" stop-color="${palette.iris[0]}"/>` +
    `<stop offset="0.55" stop-color="${palette.iris[1]}"/><stop offset="1" stop-color="${palette.iris[2]}"/></radialGradient></defs>\n` +
    `  <ellipse cx="440" cy="500" rx="${iris_radius_x}" ry="${iris_radius_y}" fill="url(#iris)"/><ellipse cx="440" cy="502" rx="9" ry="12" fill="#10120F"/>` +
    `<circle cx="447" cy="489" r="5" fill="#FFFFFF"/>`;
  const lash =
    `<path d="${eye_shape.lash}" fill="none" stroke="${palette.lash}" stroke-width="7" stroke-linecap="round"/>` +
    (eye_shape.has_lash_flick ? `<path d="M 396 484 L 392 476" stroke="${palette.lash}" stroke-width="5" stroke-linecap="round"/>` : "");
  const closed_eye = `<path d="${eye_shape.closed}" fill="none" stroke="${palette.lash}" stroke-width="6" stroke-linecap="round"/>`;
  const brow = BROW_SHAPES[features.brow_style ?? "curved"](palette.brow);
  const mouth_line = (path) => `  <path d="${path}" fill="none" stroke="${palette.mouth_line}" stroke-width="4" stroke-linecap="round"/>`;

  textures["hair_back.svg"] = svg_in_canvas(262, 170, 500, 640,
    `  <defs>${linear_gradient("hair", ...palette.hair_back)}</defs>\n  <path d="${HAIR_BACK_PATHS[features.hair_style]}" fill="url(#hair)"/>`);

  textures["body.svg"] = svg_in_canvas(232, 620, 560, 404, [
    `  <defs>\n    ${linear_gradient("hoodie", ...palette.hoodie)}\n    ${linear_gradient("neck", ...palette.neck)}\n  </defs>`,
    '  <path d="M 478 630 L 546 630 L 554 750 L 470 750 Z" fill="url(#neck)"/>',
    '  <path d="M 262 1024 C 262 860 330 762 470 732 C 490 768 534 768 554 732 C 694 762 762 860 762 1024 Z" fill="url(#hoodie)"/>',
    `  <path d="M 470 732 C 490 768 534 768 554 732" fill="none" stroke="${palette.collar}" stroke-width="6"/>`,
    ...(features.body_style === "zip_hoodie"
      ? [`  <path d="M 512 766 L 512 1024" stroke="${palette.collar}" stroke-width="5"/>`, `  <rect x="506" y="776" width="12" height="26" rx="3" fill="${palette.strings}"/>`]
      : []),
    `  <path d="M 488 762 L 480 860" stroke="${palette.strings}" stroke-width="6" stroke-linecap="round"/>`,
    `  <path d="M 536 762 L 544 860" stroke="${palette.strings}" stroke-width="6" stroke-linecap="round"/>`,
    `  <circle cx="480" cy="866" r="7" fill="${palette.strings}"/><circle cx="544" cy="866" r="7" fill="${palette.strings}"/>`,
  ].join("\n"));

  textures["face.svg"] = svg_in_canvas(332, 270, 360, 420, [
    `  <defs><radialGradient id="skin" cx="0.5" cy="0.45" r="0.6"><stop offset="0.7" stop-color="${palette.skin[0]}"/><stop offset="1" stop-color="${palette.skin[1]}"/></radialGradient></defs>`,
    `  <path d="${FACE_PATHS[features.face_style ?? "soft"]}" fill="url(#skin)"/>`,
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
  textures["eye_white_left.svg"] = part(398, 468, 84, 64, `<path d="${eye_shape.white}" fill="#FFFFFF"/>`);
  textures["eye_white_right.svg"] = part(542, 468, 84, 64, `<path d="${eye_shape.white}" fill="#FFFFFF"/>`, MIRROR_AROUND_CENTER);
  textures["iris_left.svg"] = part(417, 472, 46, 56, iris);
  textures["iris_right.svg"] = part(561, 472, 46, 56, iris, 'transform="translate(144 0)"');
  textures["lash_left.svg"] = part(390, 456, 100, 32, lash);
  textures["lash_right.svg"] = part(534, 456, 100, 32, lash, MIRROR_AROUND_CENTER);
  textures["eye_closed_left.svg"] = part(400, 492, 80, 24, closed_eye);
  textures["eye_closed_right.svg"] = part(544, 492, 80, 24, closed_eye, MIRROR_AROUND_CENTER);
  textures["brow_left.svg"] = part(396, 420, 88, 24, brow);
  textures["brow_right.svg"] = part(540, 420, 88, 24, brow, MIRROR_AROUND_CENTER);

  textures["hair_front.svg"] = svg_in_canvas(300, 180, 424, 400, [
    `  <defs>${linear_gradient("bangs", ...palette.bangs)}</defs>`,
    // A soft shadow the bangs cast on the forehead, kept inside the face.
    ...(features.has_bangs_shadow
      ? [
        `  <clipPath id="face_area"><path d="${FACE_PATHS[features.face_style ?? "soft"]}"/></clipPath>`,
        `  <path d="${BANGS_PATHS[features.bangs_style]}" transform="translate(0 14)" fill="${palette.skin[1]}" clip-path="url(#face_area)"/>`,
      ]
      : []),
    `  <path d="${BANGS_PATHS[features.bangs_style]}" fill="url(#bangs)"/>`,
    '  <path d="M 420 236 C 460 214 520 210 560 222" fill="none" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="8" stroke-linecap="round"/>',
    ...(features.bangs_style === "swept"
      ? [
        // Strand lines give the clumps shape; the accent is one colored lock running down a clump.
        `  <path d="M 428 372 Q 436 414 440 444 M 488 380 Q 494 436 498 476 M 624 372 Q 624 414 618 444 M 368 420 Q 362 470 344 530" fill="none" stroke="${palette.bangs[1]}" stroke-width="3" stroke-linecap="round"/>`,
        `  <path d="M 560 222 Q 592 232 606 266 Q 608 380 560 452 Q 586 370 560 222 Z" fill="${palette.accent}"/>`,
      ]
      : [`  <path d="M 600 250 C 630 270 650 300 660 330" fill="none" stroke="${palette.accent}" stroke-opacity="0.8" stroke-width="6" stroke-linecap="round"/>`]),
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
