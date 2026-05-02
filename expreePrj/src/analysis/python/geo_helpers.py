import json
import os

import geopandas as gpd

try:
    from shapely import make_valid
except ImportError:
    make_valid = None


def clean_geometries(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    result = gdf.copy()
    result = result[result.geometry.notna()]
    result = result[~result.geometry.is_empty]
    if result.empty:
        return result

    if make_valid:
        result["geometry"] = result.geometry.apply(make_valid)
    else:
        result["geometry"] = result.geometry.apply(lambda geometry: geometry.buffer(0))
    result = result[result.geometry.notna()]
    result = result[~result.geometry.is_empty]
    return result


def write_vector_outputs(result: gpd.GeoDataFrame, output_geojson_path: str) -> tuple[str, int]:
    if result.empty:
        raise RuntimeError("Analysis produced no valid features")

    output_shp_path = os.path.splitext(output_geojson_path)[0] + ".shp"
    output_meta_path = os.path.splitext(output_geojson_path)[0] + ".meta.json"
    os.makedirs(os.path.dirname(output_geojson_path), exist_ok=True)

    result_4326 = result.to_crs(epsg=4326)
    result_4326.to_file(output_geojson_path, driver="GeoJSON")
    result_4326.to_file(output_shp_path, driver="ESRI Shapefile", encoding="utf-8")

    bounds = [float(value) for value in result_4326.total_bounds]
    with open(output_meta_path, "w", encoding="utf-8") as meta_file:
        json.dump({"bounds": bounds, "featureCount": int(len(result_4326))}, meta_file)

    return output_shp_path, len(result_4326)
