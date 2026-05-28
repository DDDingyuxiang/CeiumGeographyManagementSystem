import os
import sys

import numpy as np
from osgeo import gdal


gdal.UseExceptions()


def read_band(dataset, band_index: int) -> tuple[np.ndarray, float | None]:
    if band_index < 1 or band_index > dataset.RasterCount:
        raise RuntimeError(
            f"Band index {band_index} is out of range. Raster has {dataset.RasterCount} bands."
        )

    band = dataset.GetRasterBand(band_index)
    return band.ReadAsArray().astype(np.float32), band.GetNoDataValue()


def create_ndvi(
    input_path: str,
    output_path: str,
    red_band_index: int,
    nir_band_index: int,
    output_nodata: float,
) -> None:
    if not os.path.exists(input_path):
        raise RuntimeError(f"Input raster not found: {input_path}")

    dataset = gdal.Open(input_path)
    if dataset is None:
        raise RuntimeError("Unable to open input raster.")

    red, red_nodata = read_band(dataset, red_band_index)
    nir, nir_nodata = read_band(dataset, nir_band_index)

    denominator = nir + red
    invalid = np.isclose(denominator, 0)
    if red_nodata is not None:
        invalid |= red == red_nodata
    if nir_nodata is not None:
        invalid |= nir == nir_nodata

    with np.errstate(divide="ignore", invalid="ignore"):
        ndvi = (nir - red) / denominator

    ndvi = np.where(invalid | ~np.isfinite(ndvi), output_nodata, ndvi).astype(np.float32)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    driver = gdal.GetDriverByName("GTiff")
    output = driver.Create(
        output_path,
        dataset.RasterXSize,
        dataset.RasterYSize,
        1,
        gdal.GDT_Float32,
        options=["TILED=YES", "COMPRESS=LZW", "BIGTIFF=IF_SAFER"],
    )
    if output is None:
        raise RuntimeError("Unable to create output raster.")

    output.SetGeoTransform(dataset.GetGeoTransform())
    output.SetProjection(dataset.GetProjection())
    output_band = output.GetRasterBand(1)
    output_band.WriteArray(ndvi)
    output_band.SetNoDataValue(output_nodata)
    output_band.FlushCache()
    output.FlushCache()
    output = None
    dataset = None

    if not os.path.exists(output_path):
        raise RuntimeError(f"NDVI output not created: {output_path}")


if __name__ == "__main__":
    try:
        create_ndvi(
            sys.argv[1],
            sys.argv[2],
            int(sys.argv[3]),
            int(sys.argv[4]),
            float(sys.argv[5]),
        )
        print(f"PYTHON_SUCCESS: ndvi={sys.argv[2]}")
    except Exception as exc:
        print(f"PYTHON_EXCEPTION: {exc}")
        sys.exit(1)
