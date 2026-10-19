/** 2D affine matrix in PixiJS layout: x' = a*x + c*y + tx, y' = b*x + d*y + ty. */
export interface AffineMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

export const IDENTITY_MATRIX: Readonly<AffineMatrix> = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

/** Returns parent * child: apply child first, then parent. */
export function multiply_matrices(parent: AffineMatrix, child: AffineMatrix): AffineMatrix {
  return {
    a: parent.a * child.a + parent.c * child.b,
    b: parent.b * child.a + parent.d * child.b,
    c: parent.a * child.c + parent.c * child.d,
    d: parent.b * child.c + parent.d * child.d,
    tx: parent.a * child.tx + parent.c * child.ty + parent.tx,
    ty: parent.b * child.tx + parent.d * child.ty + parent.ty,
  };
}

/** Scale and rotate around the pivot, then move by the translation. */
export function compose_local_matrix(
  pivot_x: number,
  pivot_y: number,
  translate_x: number,
  translate_y: number,
  rotation_degrees: number,
  scale_x: number,
  scale_y: number,
): AffineMatrix {
  const radians = (rotation_degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const matrix_without_translation = {
    a: cosine * scale_x,
    b: sine * scale_x,
    c: -sine * scale_y,
    d: cosine * scale_y,
  };
  const { a: scale_cos_x, b: scale_sin_x, c: scale_sin_y, d: scale_cos_y } = matrix_without_translation;
  return {
    ...matrix_without_translation,
    tx: pivot_x + translate_x - (scale_cos_x * pivot_x + scale_sin_y * pivot_y),
    ty: pivot_y + translate_y - (scale_sin_x * pivot_x + scale_cos_y * pivot_y),
  };
}

export function transform_point(matrix: AffineMatrix, x: number, y: number): [number, number] {
  return [matrix.a * x + matrix.c * y + matrix.tx, matrix.b * x + matrix.d * y + matrix.ty];
}
