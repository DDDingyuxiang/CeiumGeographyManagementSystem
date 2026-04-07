import os
import sys

import geopandas as gpd
from shapely.errors import GEOSException


def create_buffer(input_path: str, output_geojson_path: str, distance_m: float) -> tuple[str, int]:
    if not os.path.exists(input_path):
        raise RuntimeError(f"Input shapefile not found: {input_path}")

    gdf = gpd.read_file(input_path)
    if gdf.empty:
        raise RuntimeError("Input shapefile contains no features")

    if gdf.crs is None:
        raise RuntimeError("Input shapefile has no CRS information")

    projected = gdf.to_crs(epsg=3857)

    buffered_geometries = []
    source_ids = []

    for index, geometry in enumerate(projected.geometry, start=1):
        if geometry is None or geometry.is_empty:
            continue

        try:
            valid_geometry = geometry.buffer(0)
            if valid_geometry.is_empty:
                continue

            buffered = valid_geometry.buffer(float(distance_m))
            if buffered.is_empty:
                continue

            buffered_geometries.append(buffered)
            source_ids.append(index)
        except (ValueError, GEOSException):
            continue

    if not buffered_geometries:
        raise RuntimeError("No valid features were buffered")

    result = gpd.GeoDataFrame(
        {"src_id": source_ids},
        geometry=buffered_geometries,
        crs="EPSG:3857",
    ).to_crs(epsg=4326)

    output_shp_path = os.path.splitext(output_geojson_path)[0] + ".shp"
    os.makedirs(os.path.dirname(output_geojson_path), exist_ok=True)

    for path in (output_geojson_path, output_shp_path):
        if os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass

    result.to_file(output_geojson_path, driver="GeoJSON")
    result.to_file(output_shp_path, driver="ESRI Shapefile", encoding="utf-8")

    return output_shp_path, len(result)


if __name__ == "__main__":
    try:
        shp_path, feature_count = create_buffer(sys.argv[1], sys.argv[2], sys.argv[3])
        print(f"PYTHON_SUCCESS: Processed {feature_count} features; shp={shp_path}")
    except Exception as exc:
        print(f"PYTHON_EXCEPTION: {exc}")
        sys.exit(1)
