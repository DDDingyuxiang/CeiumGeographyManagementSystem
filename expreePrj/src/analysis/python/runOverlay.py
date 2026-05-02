import sys

import geopandas as gpd

from geo_helpers import clean_geometries, write_vector_outputs


SUPPORTED_OPERATIONS = {"intersection", "union", "difference"}


def overlay_features(
    input_path: str,
    overlay_path: str,
    output_geojson_path: str,
    operation: str,
) -> tuple[str, int]:
    if operation not in SUPPORTED_OPERATIONS:
        raise RuntimeError(f"Unsupported overlay operation: {operation}")

    left = gpd.read_file(input_path)
    right = gpd.read_file(overlay_path)
    if left.empty or right.empty:
        raise RuntimeError("Both overlay inputs must contain features")
    if left.crs is None or right.crs is None:
        raise RuntimeError("Both overlay inputs must have CRS information")

    left = clean_geometries(left).to_crs(epsg=3857)
    right = clean_geometries(right).to_crs(left.crs)
    result = gpd.overlay(left, right, how=operation, keep_geom_type=False)
    result = clean_geometries(result)

    return write_vector_outputs(result, output_geojson_path)


if __name__ == "__main__":
    try:
        shp_path, feature_count = overlay_features(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
        print(f"PYTHON_SUCCESS: Overlay produced {feature_count} features; shp={shp_path}")
    except Exception as exc:
        print(f"PYTHON_EXCEPTION: {exc}")
        sys.exit(1)
