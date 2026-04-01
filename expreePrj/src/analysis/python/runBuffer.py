import os
import sys
from osgeo import gdal, ogr, osr

gdal.UseExceptions()


def create_buffer(input_path, output_path, distance_m):
    try:
        input_driver = ogr.GetDriverByName("ESRI Shapefile")
        ds = input_driver.Open(input_path, 0)
        if ds is None:
            raise RuntimeError(f"Cannot open input shapefile: {input_path}")

        in_layer = ds.GetLayer()
        in_spatial_ref = in_layer.GetSpatialRef()
        if in_spatial_ref is None:
            raise RuntimeError("Input shapefile has no spatial reference")

        web_mercator = osr.SpatialReference()
        web_mercator.ImportFromEPSG(3857)
        wgs84 = osr.SpatialReference()
        wgs84.ImportFromEPSG(4326)

        transform = osr.CoordinateTransformation(in_spatial_ref, web_mercator)
        back_transform = osr.CoordinateTransformation(web_mercator, wgs84)

        out_driver = ogr.GetDriverByName("ESRI Shapefile")
        if os.path.exists(output_path):
            out_driver.DeleteDataSource(output_path)

        out_ds = out_driver.CreateDataSource(output_path)
        layer_name = os.path.splitext(os.path.basename(output_path))[0]
        out_layer = out_ds.CreateLayer(layer_name, srs=wgs84, geom_type=ogr.wkbMultiPolygon)

        count = 0
        for feature in in_layer:
            geom = feature.GetGeometryRef()
            if geom is None or geom.IsEmpty():
                continue

            valid_geom = geom.MakeValid()
            if valid_geom is None or valid_geom.IsEmpty():
                continue

            clean_geom = valid_geom.Buffer(0)

            try:
                clean_geom.Transform(transform)
                buffered = clean_geom.Buffer(float(distance_m))

                if buffered is not None and not buffered.IsEmpty():
                    buffered.Transform(back_transform)
                    out_feature = ogr.Feature(out_layer.GetLayerDefn())
                    out_feature.SetGeometry(buffered)
                    out_layer.CreateFeature(out_feature)
                    out_feature = None
                    count += 1
            except Exception:
                continue

        if count == 0:
            raise RuntimeError("No valid features were buffered")

        out_ds.FlushCache()
        out_ds = None
        ds = None
        print(f"PYTHON_SUCCESS: Processed {count} features")

    except Exception as exc:
        print(f"PYTHON_EXCEPTION: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    create_buffer(sys.argv[1], sys.argv[2], sys.argv[3])
