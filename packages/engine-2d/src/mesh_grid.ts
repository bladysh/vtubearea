export interface GridRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridGeometryData {
  /** Rest positions in canvas pixels, [x, y] per vertex, row by row. */
  rest_positions: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

/** A (columns x rows) cell grid covering the rect, two triangles per cell. */
export function create_grid_geometry(rect: GridRect, columns: number, rows: number): GridGeometryData {
  const vertex_columns = columns + 1;
  const vertex_count = vertex_columns * (rows + 1);
  const rest_positions = new Float32Array(vertex_count * 2);
  const uvs = new Float32Array(vertex_count * 2);

  for (let row_index = 0; row_index <= rows; row_index += 1) {
    for (let column_index = 0; column_index <= columns; column_index += 1) {
      const vertex_index = row_index * vertex_columns + column_index;
      const horizontal_fraction = column_index / columns;
      const vertical_fraction = row_index / rows;
      uvs[vertex_index * 2] = horizontal_fraction;
      uvs[vertex_index * 2 + 1] = vertical_fraction;
      rest_positions[vertex_index * 2] = rect.x + horizontal_fraction * rect.width;
      rest_positions[vertex_index * 2 + 1] = rect.y + vertical_fraction * rect.height;
    }
  }

  const indices = new Uint32Array(columns * rows * 6);
  let write_index = 0;
  for (let row_index = 0; row_index < rows; row_index += 1) {
    for (let column_index = 0; column_index < columns; column_index += 1) {
      const top_left = row_index * vertex_columns + column_index;
      const bottom_left = top_left + vertex_columns;
      indices.set([top_left, top_left + 1, bottom_left, top_left + 1, bottom_left + 1, bottom_left], write_index);
      write_index += 6;
    }
  }
  return { rest_positions, uvs, indices };
}
