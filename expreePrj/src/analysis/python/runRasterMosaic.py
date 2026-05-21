import os
import sys

from osgeo import gdal


gdal.UseExceptions()


def parse_nodata(raw_value: str):
    if raw_value == "none":
        return None
    return float(raw_value)


def read_inputs(input_list_path: str) -> list[str]:
    with open(input_list_path, "r", encoding="utf-8") as input_file:
        paths = [line.strip() for line in input_file.readlines() if line.strip()]

    missing = [path for path in paths if not os.path.exists(path)]
    if missing:
        raise RuntimeError(f"Input raster not found: {missing[0]}")

    if len(paths) < 2:
        raise RuntimeError("Mosaic requires at least two raster inputs.")

    return paths


def mosaic_rasters(
    input_list_path: str,
    output_path: str,
    resampling: str,
    nodata,
) -> None:
    input_paths = read_inputs(input_list_path)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    vrt_path = os.path.splitext(output_path)[0] + ".vrt"

    vrt_options = {"resampleAlg": resampling}
    if nodata is not None:
        vrt_options["srcNodata"] = nodata
        vrt_options["VRTNodata"] = nodata

    vrt = gdal.BuildVRT(vrt_path, input_paths, options=gdal.BuildVRTOptions(**vrt_options))
    if vrt is None:
        raise RuntimeError("GDAL BuildVRT returned no dataset.")
    vrt.FlushCache()
    vrt = None

    translate_options = gdal.TranslateOptions(
        format="GTiff",
        resampleAlg=resampling,
        creationOptions=["TILED=YES", "COMPRESS=LZW", "BIGTIFF=IF_SAFER"],
        noData=nodata,
    )
    result = gdal.Translate(output_path, vrt_path, options=translate_options)
    if result is None:
        raise RuntimeError("GDAL Translate returned no dataset.")

    result.FlushCache()
    result = None

    if not os.path.exists(output_path):
        raise RuntimeError(f"Mosaic output not created: {output_path}")


if __name__ == "__main__":
    try:
        mosaic_rasters(
            sys.argv[1],
            sys.argv[2],
            sys.argv[3].lower(),
            parse_nodata(sys.argv[4]),
        )
        print(f"PYTHON_SUCCESS: mosaic={sys.argv[2]}")
    except Exception as exc:
        print(f"PYTHON_EXCEPTION: {exc}")
        sys.exit(1)
