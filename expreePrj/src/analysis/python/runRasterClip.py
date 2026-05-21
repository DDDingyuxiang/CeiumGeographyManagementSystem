import os
import sys

from osgeo import gdal


gdal.UseExceptions()


def parse_nodata(raw_value: str):
    if raw_value == "none":
        return None
    return float(raw_value)


def clip_raster(
    input_path: str,
    output_path: str,
    mode: str,
    mask_path: str,
    bounds: list[float],
    nodata,
) -> None:
    if not os.path.exists(input_path):
        raise RuntimeError(f"Input raster not found: {input_path}")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    options = {
        "format": "GTiff",
        "creationOptions": ["TILED=YES", "COMPRESS=LZW", "BIGTIFF=IF_SAFER"],
    }

    if nodata is not None:
        options["dstNodata"] = nodata

    if mode == "mask":
        if not os.path.exists(mask_path):
            raise RuntimeError(f"Mask vector not found: {mask_path}")
        options.update(
            {
                "cutlineDSName": mask_path,
                "cropToCutline": True,
            }
        )
    elif mode == "extent":
        if len(bounds) != 4:
            raise RuntimeError("Extent mode requires four bounds.")
        options["outputBounds"] = bounds
    else:
        raise RuntimeError(f"Unsupported clip mode: {mode}")

    result = gdal.Warp(output_path, input_path, options=gdal.WarpOptions(**options))
    if result is None:
        raise RuntimeError("GDAL Warp returned no dataset.")

    result.FlushCache()
    result = None

    if not os.path.exists(output_path):
        raise RuntimeError(f"Clip output not created: {output_path}")


if __name__ == "__main__":
    try:
        mode_arg = sys.argv[3].lower()
        nodata_arg = parse_nodata(sys.argv[9])
        bound_args = []
        if mode_arg == "extent":
            bound_args = [float(value) for value in sys.argv[5:9]]

        clip_raster(
            sys.argv[1],
            sys.argv[2],
            mode_arg,
            sys.argv[4],
            bound_args,
            nodata_arg,
        )
        print(f"PYTHON_SUCCESS: clip={sys.argv[2]}")
    except Exception as exc:
        print(f"PYTHON_EXCEPTION: {exc}")
        sys.exit(1)
