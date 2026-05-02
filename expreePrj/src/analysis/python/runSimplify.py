import sys

import geopandas as gpd

from geo_helpers import clean_geometries, write_vector_outputs


def simplify_features(
    input_path: str,
    output_geojson_path: str,
    tolerance_m: float,
    preserve_topology: bool,
) -> tuple[str, int]:
    gdf = gpd.read_file(input_path)
    if gdf.empty:
        raise RuntimeError("Input layer contains no features")
    if gdf.crs is None:
        raise RuntimeError("Input layer has no CRS information")

    projected = clean_geometries(gdf).to_crs(epsg=3857)
    projected["geometry"] = projected.geometry.simplify(
        float(tolerance_m),
        preserve_topology=preserve_topology,
    )
    result = clean_geometries(projected)

    return write_vector_outputs(result, output_geojson_path)


if __name__ == "__main__":
    try:
        tolerance = float(sys.argv[3])
        preserve = str(sys.argv[4]).lower() != "false"
        shp_path, feature_count = simplify_features(sys.argv[1], sys.argv[2], tolerance, preserve)
        print(f"PYTHON_SUCCESS: Simplified {feature_count} features; shp={shp_path}")
    except Exception as exc:
        print(f"PYTHON_EXCEPTION: {exc}")
        sys.exit(1)
