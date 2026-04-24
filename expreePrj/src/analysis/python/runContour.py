import os
import json
import sys

from osgeo import gdal, ogr, osr


gdal.UseExceptions()


def remove_shapefile_family(shapefile_path: str) -> None:
    base, _ = os.path.splitext(shapefile_path)
    for ext in (".shp", ".shx", ".dbf", ".prj", ".cpg", ".qix"):
        target = f"{base}{ext}"
        if os.path.exists(target):
            os.remove(target)


def transform_shapefile(source_path: str, target_path: str, target_epsg: int) -> None:
    source_ds = ogr.Open(source_path)
    if source_ds is None:
        raise RuntimeError(f"Unable to open source shapefile: {source_path}")

    source_layer = source_ds.GetLayer(0)
    if source_layer is None:
        raise RuntimeError("Unable to read source contour layer.")

    source_srs = source_layer.GetSpatialRef()
    if source_srs is None:
        raise RuntimeError("Source contour layer has no spatial reference.")

    if hasattr(source_srs, "SetAxisMappingStrategy"):
        source_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)

    target_srs = osr.SpatialReference()
    target_srs.ImportFromEPSG(target_epsg)
    if hasattr(target_srs, "SetAxisMappingStrategy"):
        target_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)

    transform = osr.CoordinateTransformation(source_srs, target_srs)

    shp_driver = ogr.GetDriverByName("ESRI Shapefile")
    if shp_driver is None:
        raise RuntimeError("ESRI Shapefile driver is not available.")

    remove_shapefile_family(target_path)

    target_ds = shp_driver.CreateDataSource(target_path)
    if target_ds is None:
        raise RuntimeError(f"Unable to create target shapefile: {target_path}")

    target_layer = target_ds.CreateLayer(
        os.path.splitext(os.path.basename(target_path))[0],
        srs=target_srs,
        geom_type=source_layer.GetGeomType(),
    )
    if target_layer is None:
        raise RuntimeError("Unable to create target contour layer.")

    source_defn = source_layer.GetLayerDefn()
    for index in range(source_defn.GetFieldCount()):
        target_layer.CreateField(source_defn.GetFieldDefn(index))

    target_defn = target_layer.GetLayerDefn()
    source_layer.ResetReading()

    for source_feature in source_layer:
        target_feature = ogr.Feature(target_defn)

        for index in range(target_defn.GetFieldCount()):
            field_name = target_defn.GetFieldDefn(index).GetNameRef()
            target_feature.SetField(field_name, source_feature.GetField(field_name))

        geometry = source_feature.GetGeometryRef()
        if geometry is not None:
            geometry = geometry.Clone()
            geometry.Transform(transform)
            target_feature.SetGeometry(geometry)

        if target_layer.CreateFeature(target_feature) != 0:
            raise RuntimeError("Unable to write transformed contour feature.")

        target_feature = None

    target_layer = None
    target_ds = None
    source_ds = None


def create_geojson_copy(shapefile_path: str, geojson_path: str) -> None:
    shp_ds = ogr.Open(shapefile_path)
    if shp_ds is None:
        raise RuntimeError(f"Unable to open contour shapefile: {shapefile_path}")

    source_layer = shp_ds.GetLayer(0)
    if source_layer is None:
        raise RuntimeError("Unable to read contour source layer.")

    geojson_driver = ogr.GetDriverByName("GeoJSON")
    if geojson_driver is None:
        raise RuntimeError("GeoJSON driver is not available.")

    if os.path.exists(geojson_path):
        geojson_driver.DeleteDataSource(geojson_path)

    geojson_ds = geojson_driver.CreateDataSource(geojson_path)
    if geojson_ds is None:
        raise RuntimeError(f"Unable to create GeoJSON datasource: {geojson_path}")

    source_srs = source_layer.GetSpatialRef()
    target_srs = osr.SpatialReference()
    target_srs.ImportFromEPSG(4326)

    if source_srs is not None and hasattr(source_srs, "SetAxisMappingStrategy"):
        source_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    if hasattr(target_srs, "SetAxisMappingStrategy"):
        target_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)

    transform = None
    if source_srs is not None and not source_srs.IsSame(target_srs):
        transform = osr.CoordinateTransformation(source_srs, target_srs)

    target_layer = geojson_ds.CreateLayer(
        source_layer.GetName(),
        srs=target_srs,
        geom_type=source_layer.GetGeomType(),
    )
    if target_layer is None:
        raise RuntimeError("Unable to create target GeoJSON layer.")

    source_defn = source_layer.GetLayerDefn()
    for index in range(source_defn.GetFieldCount()):
        field_defn = source_defn.GetFieldDefn(index)
        target_layer.CreateField(field_defn)

    target_defn = target_layer.GetLayerDefn()
    source_layer.ResetReading()
    min_x = None
    min_y = None
    max_x = None
    max_y = None

    for source_feature in source_layer:
        target_feature = ogr.Feature(target_defn)

        for index in range(target_defn.GetFieldCount()):
            field_name = target_defn.GetFieldDefn(index).GetNameRef()
            target_feature.SetField(field_name, source_feature.GetField(field_name))

        geometry = source_feature.GetGeometryRef()
        if geometry is not None:
            geometry = geometry.Clone()
            if transform is not None:
                geometry.Transform(transform)
            envelope = geometry.GetEnvelope()
            if envelope is not None:
                geom_min_x, geom_max_x, geom_min_y, geom_max_y = envelope
                min_x = geom_min_x if min_x is None else min(min_x, geom_min_x)
                min_y = geom_min_y if min_y is None else min(min_y, geom_min_y)
                max_x = geom_max_x if max_x is None else max(max_x, geom_max_x)
                max_y = geom_max_y if max_y is None else max(max_y, geom_max_y)
            target_feature.SetGeometry(geometry)

        if target_layer.CreateFeature(target_feature) != 0:
            raise RuntimeError("Unable to write GeoJSON contour feature.")

        target_feature = None

    geojson_ds = None
    shp_ds = None

    if None in (min_x, min_y, max_x, max_y):
        raise RuntimeError("Unable to calculate contour bounds.")

    meta_path = f"{os.path.splitext(geojson_path)[0]}.meta.json"
    with open(meta_path, "w", encoding="utf-8") as meta_file:
        json.dump(
            {
                "bounds": [min_x, min_y, max_x, max_y],
            },
            meta_file,
            ensure_ascii=False,
        )


def create_contours(
    input_path: str,
    shapefile_path: str,
    geojson_path: str,
    interval: float,
    base: float,
) -> None:
    if not os.path.exists(input_path):
        raise RuntimeError(f"Input raster not found: {input_path}")

    output_dir = os.path.dirname(shapefile_path)
    os.makedirs(output_dir, exist_ok=True)
    native_shapefile_path = os.path.join(output_dir, "_native_contours.shp")

    dataset = gdal.Open(input_path)
    if dataset is None:
        raise RuntimeError("Unable to open input raster.")

    band = dataset.GetRasterBand(1)
    if band is None:
        raise RuntimeError("Input raster does not contain band 1.")

    shp_driver = ogr.GetDriverByName("ESRI Shapefile")
    if shp_driver is None:
        raise RuntimeError("ESRI Shapefile driver is not available.")

    remove_shapefile_family(native_shapefile_path)

    contour_ds = shp_driver.CreateDataSource(native_shapefile_path)
    if contour_ds is None:
        raise RuntimeError(f"Unable to create contour shapefile: {native_shapefile_path}")

    spatial_ref = None
    projection_wkt = dataset.GetProjection()
    if projection_wkt:
        spatial_ref = osr.SpatialReference()
        spatial_ref.ImportFromWkt(projection_wkt)

    layer_name = os.path.splitext(os.path.basename(shapefile_path))[0]
    contour_layer = contour_ds.CreateLayer(layer_name, srs=spatial_ref, geom_type=ogr.wkbLineString)
    if contour_layer is None:
        raise RuntimeError("Unable to create contour layer.")

    contour_layer.CreateField(ogr.FieldDefn("ID", ogr.OFTInteger))
    contour_layer.CreateField(ogr.FieldDefn("ELEV", ogr.OFTReal))

    id_field_index = contour_layer.GetLayerDefn().GetFieldIndex("ID")
    elev_field_index = contour_layer.GetLayerDefn().GetFieldIndex("ELEV")

    gdal.ContourGenerate(
        band,
        float(interval),
        float(base),
        [],
        0,
        0.0,
        contour_layer,
        id_field_index,
        elev_field_index,
    )

    contour_layer = None
    contour_ds = None
    band = None
    dataset = None

    if not os.path.exists(native_shapefile_path):
        raise RuntimeError(f"Contour shapefile not created: {native_shapefile_path}")

    transform_shapefile(native_shapefile_path, shapefile_path, 4326)
    create_geojson_copy(shapefile_path, geojson_path)
    remove_shapefile_family(native_shapefile_path)


if __name__ == "__main__":
    try:
        create_contours(
            sys.argv[1],
            sys.argv[2],
            sys.argv[3],
            float(sys.argv[4]),
            float(sys.argv[5]),
        )
        print(f"PYTHON_SUCCESS: contour={sys.argv[2]}")
    except Exception as exc:
        print(f"PYTHON_EXCEPTION: {exc}")
        sys.exit(1)
