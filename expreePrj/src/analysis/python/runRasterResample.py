import os
import sys

from osgeo import gdal


gdal.UseExceptions()


def parse_nodata(raw_value: str):
    if raw_value == "none":
        return None
    return float(raw_value)


def resample_raster(
    input_path: str,
    output_path: str,
    pixel_size: float,
    resampling: str,
    nodata,
) -> None:
    if not os.path.exists(input_path):
        raise RuntimeError(f"Input raster not found: {input_path}")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    options = {
        "format": "GTiff",
        "xRes": pixel_size,
        "yRes": pixel_size,
        "resampleAlg": resampling,
        "creationOptions": ["TILED=YES", "COMPRESS=LZW", "BIGTIFF=IF_SAFER"],
    }

    if nodata is not None:
        options["dstNodata"] = nodata

    result = gdal.Warp(output_path, input_path, options=gdal.WarpOptions(**options))
    if result is None:
        raise RuntimeError("GDAL Warp returned no dataset.")

    result.FlushCache()
    result = None

    if not os.path.exists(output_path):
        raise RuntimeError(f"Resample output not created: {output_path}")


if __name__ == "__main__":
    try:
        resample_raster(
            sys.argv[1],
            sys.argv[2],
            float(sys.argv[3]),
            sys.argv[4].lower(),
            parse_nodata(sys.argv[5]),
        )
        print(f"PYTHON_SUCCESS: resample={sys.argv[2]}")
    except Exception as exc:
        print(f"PYTHON_EXCEPTION: {exc}")
        sys.exit(1)
