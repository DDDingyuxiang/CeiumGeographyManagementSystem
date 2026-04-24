import os
import sys

from osgeo import gdal


gdal.UseExceptions()


def build_processing_options(
    analysis_type: str,
    z_factor: float,
    scale: float,
):
    processing = analysis_type.lower()
    options = ["-compute_edges", "-alg", "Horn"]

    if processing == "slope":
        if scale > 0:
            options.extend(["-s", str(float(scale))])
        options.extend(["-z", str(float(z_factor))])
    elif processing == "aspect":
        pass
    else:
        raise RuntimeError(f"Unsupported analysis type: {analysis_type}")

    return processing, gdal.DEMProcessingOptions(options=options)


def create_dem_derivative(
    input_path: str,
    output_path: str,
    analysis_type: str,
    z_factor: float,
    scale: float,
) -> None:
    if not os.path.exists(input_path):
        raise RuntimeError(f"Input raster not found: {input_path}")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    dataset = gdal.Open(input_path)
    if dataset is None:
        raise RuntimeError("Unable to open input raster.")

    processing, options = build_processing_options(analysis_type, z_factor, scale)
    result = gdal.DEMProcessing(output_path, dataset, processing, options=options)

    if result is None:
        raise RuntimeError(f"GDAL DEMProcessing returned no dataset for {processing}.")

    result.FlushCache()
    result = None
    dataset = None

    if not os.path.exists(output_path):
        raise RuntimeError(f"Output raster not created: {output_path}")


if __name__ == "__main__":
    try:
        create_dem_derivative(
            sys.argv[1],
            sys.argv[2],
            sys.argv[3],
            float(sys.argv[4]),
            float(sys.argv[5]),
        )
        print(f"PYTHON_SUCCESS: derivative={sys.argv[2]}")
    except Exception as exc:
        print(f"PYTHON_EXCEPTION: {exc}")
        sys.exit(1)
