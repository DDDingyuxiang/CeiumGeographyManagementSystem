import json
import math
import os
import shutil
import sys
from pathlib import Path

import numpy as np
import rasterio
from quantized_mesh_encoder import MetadataExtension, encode
from rasterio.enums import Resampling
from rasterio.fill import fillnodata
from rasterio.transform import from_bounds
from rasterio.vrt import WarpedVRT
from rasterio.warp import reproject, transform_bounds


GRID_SIZE = 65
MIN_ZOOM = 0
MAX_ZOOM_LIMIT = 8
DEM_NAME_KEYWORDS = ("dem", "dtm", "dsm", "elevation", "terrain", "height", "高程", "地形")


def is_dem_dataset(dataset: rasterio.DatasetReader, source_name: str = "") -> tuple[bool, str]:
    if dataset.count != 1:
        return False, f"band_count={dataset.count}"

    if dataset.crs is None:
        return False, "missing_crs"

    dtype = np.dtype(dataset.dtypes[0])
    if dtype.kind not in ("i", "u", "f"):
        return False, f"unsupported_dtype={dataset.dtypes[0]}"

    colorinterp = str(dataset.colorinterp[0]).lower() if dataset.colorinterp else ""
    if "red" in colorinterp or "green" in colorinterp or "blue" in colorinterp:
        return False, f"colorinterp={colorinterp}"

    band = dataset.read(1, masked=True)
    values = band.compressed()
    if values.size == 0:
        return False, "empty_band"

    unique_count = int(np.unique(values).size)
    value_range = float(values.max() - values.min())
    lowered_name = source_name.lower()
    hinted_as_dem = any(keyword in lowered_name for keyword in DEM_NAME_KEYWORDS)

    # 保守判定：避免把单波段专题图/分类图误判成 DEM
    if not hinted_as_dem and unique_count < 128:
        return False, f"unique_values_too_few={unique_count}"

    if not hinted_as_dem and value_range < 100:
        return False, f"value_range_too_small={value_range}"

    return True, "single_band_numeric"


def clamp_bounds(bounds: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
    west, south, east, north = bounds
    west = max(-180.0, min(180.0, west))
    east = max(-180.0, min(180.0, east))
    south = max(-90.0, min(90.0, south))
    north = max(-90.0, min(90.0, north))
    if east <= west or north <= south:
        raise RuntimeError("Invalid DEM bounds after reprojection.")
    return west, south, east, north


def choose_max_zoom(vrt: WarpedVRT) -> int:
    native_res = max(abs(vrt.transform.a), abs(vrt.transform.e))
    if native_res <= 0:
        return 6

    estimated = math.log2(180.0 / (native_res * (GRID_SIZE - 1)))
    if not math.isfinite(estimated):
        return 6

    return max(MIN_ZOOM, min(MAX_ZOOM_LIMIT, int(round(estimated))))


def geographic_tile_bounds(x: int, y: int, z: int) -> tuple[float, float, float, float]:
    num_x = 2 ** (z + 1)
    num_y = 2 ** z
    tile_width = 360.0 / num_x
    tile_height = 180.0 / num_y
    west = -180.0 + x * tile_width
    south = -90.0 + y * tile_height
    east = west + tile_width
    north = south + tile_height
    return west, south, east, north


def tile_ranges(bounds: tuple[float, float, float, float], z: int) -> tuple[range, range]:
    west, south, east, north = bounds
    num_x = 2 ** (z + 1)
    num_y = 2 ** z
    tile_width = 360.0 / num_x
    tile_height = 180.0 / num_y
    epsilon = 1e-9

    min_x = max(0, min(num_x - 1, int(math.floor((west + 180.0) / tile_width))))
    max_x = max(0, min(num_x - 1, int(math.floor((east + 180.0 - epsilon) / tile_width))))
    min_y = max(0, min(num_y - 1, int(math.floor((south + 90.0) / tile_height))))
    max_y = max(0, min(num_y - 1, int(math.floor((north + 90.0 - epsilon) / tile_height))))

    return range(min_x, max_x + 1), range(min_y, max_y + 1)


def build_positions(tile_bounds: tuple[float, float, float, float], heights: np.ndarray) -> np.ndarray:
    west, south, east, north = tile_bounds
    xs = np.linspace(west, east, GRID_SIZE, dtype=np.float32)
    # Raster rows are ordered from north to south. Keep latitude ordering
    # aligned with the sampled height grid so triangle winding stays correct.
    ys = np.linspace(north, south, GRID_SIZE, dtype=np.float32)
    mesh_x, mesh_y = np.meshgrid(xs, ys)
    return np.column_stack(
        [mesh_x.reshape(-1), mesh_y.reshape(-1), heights.reshape(-1).astype(np.float32)]
    )


def build_indices() -> np.ndarray:
    indices: list[tuple[int, int, int]] = []
    for row in range(GRID_SIZE - 1):
        for col in range(GRID_SIZE - 1):
            top_left = row * GRID_SIZE + col
            top_right = top_left + 1
            bottom_left = top_left + GRID_SIZE
            bottom_right = bottom_left + 1
            indices.append((top_left, bottom_left, top_right))
            indices.append((top_right, bottom_left, bottom_right))

    return np.asarray(indices, dtype=np.uint32)


TRIANGLE_INDICES = build_indices()


def sample_tile(vrt: WarpedVRT, tile_bounds: tuple[float, float, float, float]) -> np.ndarray | None:
    destination = np.full((GRID_SIZE, GRID_SIZE), np.nan, dtype=np.float32)
    dst_transform = from_bounds(*tile_bounds, GRID_SIZE, GRID_SIZE)
    src_nodata = vrt.nodata if vrt.nodata is not None else np.nan

    reproject(
        source=rasterio.band(vrt, 1),
        destination=destination,
        src_transform=vrt.transform,
        src_crs=vrt.crs,
        src_nodata=src_nodata,
        dst_transform=dst_transform,
        dst_crs="EPSG:4326",
        dst_nodata=np.nan,
        resampling=Resampling.bilinear,
        init_dest_nodata=True,
    )

    if np.isfinite(src_nodata):
        destination[np.isclose(destination, src_nodata)] = np.nan

    valid_mask = np.isfinite(destination)
    if not valid_mask.any():
        return None

    if not valid_mask.all():
        destination = fillnodata(
            destination,
            mask=valid_mask.astype("uint8"),
            max_search_distance=GRID_SIZE,
            smoothing_iterations=0,
        )

    if not np.isfinite(destination).all():
        fallback = float(np.nanmean(destination[valid_mask]))
        destination = np.where(np.isfinite(destination), destination, fallback)

    return destination.astype(np.float32)


def write_layer_json(
    output_dir: Path,
    bounds: tuple[float, float, float, float],
    minzoom: int,
    maxzoom: int,
    available: list[list[dict[str, int]]],
) -> None:
    layer_json = {
        "tilejson": "2.1.0",
        "format": "quantized-mesh-1.0",
        "version": "1.0.0",
        "scheme": "tms",
        "projection": "EPSG:4326",
        "tiles": ["{z}/{x}/{y}.terrain"],
        "bounds": [round(v, 8) for v in bounds],
        "minzoom": minzoom,
        "maxzoom": maxzoom,
        "available": available,
    }
    (output_dir / "layer.json").write_text(
        json.dumps(layer_json, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def write_metadata(
    output_dir: Path,
    bounds: tuple[float, float, float, float],
    minzoom: int,
    maxzoom: int,
    tile_count: int,
    available: list[list[dict[str, int]]],
) -> None:
    metadata = {
        "bounds": [round(v, 8) for v in bounds],
        "minzoom": minzoom,
        "maxzoom": maxzoom,
        "tileCount": tile_count,
        "available": available,
    }
    (output_dir / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def convert_dem_to_terrain(
    input_tif: str, output_dir: str, source_name: str = ""
) -> tuple[bool, dict]:
    output_path = Path(output_dir)
    if output_path.exists():
        shutil.rmtree(output_path)
    output_path.mkdir(parents=True, exist_ok=True)

    with rasterio.open(input_tif) as dataset:
        is_dem, reason = is_dem_dataset(dataset, source_name)
        if not is_dem:
            return False, {"reason": reason}

        bounds_4326 = clamp_bounds(transform_bounds(dataset.crs, "EPSG:4326", *dataset.bounds))

        with WarpedVRT(dataset, crs="EPSG:4326", resampling=Resampling.bilinear) as vrt:
            maxzoom = choose_max_zoom(vrt)
            tile_count = 0
            generated_zooms: set[int] = set()
            generated_tiles: dict[int, set[tuple[int, int]]] = {}

            for z in range(MIN_ZOOM, maxzoom + 1):
                x_range, y_range = tile_ranges(bounds_4326, z)
                for x in x_range:
                    for y in y_range:
                        tile_bounds = geographic_tile_bounds(x, y, z)
                        heights = sample_tile(vrt, tile_bounds)
                        if heights is None:
                            continue

                        positions = build_positions(tile_bounds, heights)
                        metadata_ext = MetadataExtension(
                            data={
                                "source": os.path.basename(input_tif),
                                "z": z,
                                "x": x,
                                "y": y,
                            }
                        )

                        tile_dir = output_path / str(z) / str(x)
                        tile_dir.mkdir(parents=True, exist_ok=True)
                        with open(tile_dir / f"{y}.terrain", "wb") as f:
                            encode(
                                f,
                                positions,
                                TRIANGLE_INDICES,
                                bounds=(tile_bounds[0], tile_bounds[1], tile_bounds[2], tile_bounds[3]),
                                extensions=(metadata_ext,),
                            )
                        tile_count += 1
                        generated_zooms.add(z)
                        generated_tiles.setdefault(z, set()).add((x, y))

    if tile_count == 0:
        raise RuntimeError("No terrain tiles were generated from DEM.")

    actual_minzoom = min(generated_zooms)
    actual_maxzoom = max(generated_zooms)
    available: list[list[dict[str, int]]] = []
    for z in range(actual_minzoom, actual_maxzoom + 1):
        tiles = sorted(generated_tiles.get(z, set()))
        ranges: list[dict[str, int]] = []
        if tiles:
            by_y: dict[int, list[int]] = {}
            for x, y in tiles:
                by_y.setdefault(y, []).append(x)

            for y, xs in sorted(by_y.items()):
                xs = sorted(xs)
                start_x = xs[0]
                end_x = xs[0]
                for x in xs[1:]:
                    if x == end_x + 1:
                        end_x = x
                        continue

                    ranges.append(
                        {"startX": start_x, "startY": y, "endX": end_x, "endY": y}
                    )
                    start_x = x
                    end_x = x

                ranges.append(
                    {"startX": start_x, "startY": y, "endX": end_x, "endY": y}
                )

        available.append(ranges)

    write_layer_json(output_path, bounds_4326, actual_minzoom, actual_maxzoom, available)
    write_metadata(
        output_path,
        bounds_4326,
        actual_minzoom,
        actual_maxzoom,
        tile_count,
        available,
    )
    return True, {
        "bounds": [round(v, 8) for v in bounds_4326],
        "minzoom": actual_minzoom,
        "maxzoom": actual_maxzoom,
        "tileCount": tile_count,
        "available": available,
    }


if __name__ == "__main__":
    try:
        source_name = sys.argv[3] if len(sys.argv) > 3 else ""
        generated, payload = convert_dem_to_terrain(sys.argv[1], sys.argv[2], source_name)
        if generated:
            print(f"PYTHON_SUCCESS: {json.dumps(payload, ensure_ascii=False)}")
        else:
            print(f"PYTHON_NOT_DEM: {json.dumps(payload, ensure_ascii=False)}")
    except Exception as exc:
        print(f"PYTHON_EXCEPTION: {exc}")
        sys.exit(1)
