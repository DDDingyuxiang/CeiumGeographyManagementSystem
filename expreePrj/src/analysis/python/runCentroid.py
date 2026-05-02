import sys

import geopandas as gpd

from geo_helpers import clean_geometries, write_vector_outputs


def extract_centroids(
    input_path: str,
    output_geojson_path: str,
    mode: str,
) -> tuple[str, int]:
    gdf = gpd.read_file(input_path)
    if gdf.empty:
        raise RuntimeError("Input layer contains no features")
    if gdf.crs is None:
        raise RuntimeError("Input layer has no CRS information")

    projected = clean_geometries(gdf).to_crs(epsg=3857)
    if mode == "representative_point":
        projected["geometry"] = projected.geometry.representative_point()
    else:
        projected["geometry"] = projected.geometry.centroid

    result = clean_geometries(projected)
    return write_vector_outputs(result, output_geojson_path)


if __name__ == "__main__":
    try:
        shp_path, feature_count = extract_centroids(sys.argv[1], sys.argv[2], sys.argv[3])
        print(f"PYTHON_SUCCESS: Extracted {feature_count} centroids; shp={shp_path}")
    except Exception as exc:
        print(f"PYTHON_EXCEPTION: {exc}")
        sys.exit(1)
