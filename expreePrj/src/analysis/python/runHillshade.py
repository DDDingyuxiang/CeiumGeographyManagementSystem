import os
import sys

from osgeo import gdal


def create_hillshade(
    input_path: str,
    output_path: str,
    azimuth: float,
    altitude: float,
    z_factor: float,
) -> None:
    if not os.path.exists(input_path):
        raise RuntimeError(f"Input raster not found: {input_path}")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    dataset = gdal.Open(input_path)
    if dataset is None:
        raise RuntimeError("Unable to open input raster.")

    result = gdal.DEMProcessing(
        output_path,
        dataset,
        "hillshade",
        azimuth=float(azimuth),
        altitude=float(altitude),
        zFactor=float(z_factor),
        computeEdges=True,
    )

    if result is None:
        raise RuntimeError("GDAL DEMProcessing returned no dataset.")

    result.FlushCache()
    result = None
    dataset = None

    if not os.path.exists(output_path):
        raise RuntimeError(f"Hillshade output not created: {output_path}")


if __name__ == "__main__":
    try:
        create_hillshade(
            sys.argv[1],
            sys.argv[2],
            float(sys.argv[3]),
            float(sys.argv[4]),
            float(sys.argv[5]),
        )
        print(f"PYTHON_SUCCESS: hillshade={sys.argv[2]}")
    except Exception as exc:
        print(f"PYTHON_EXCEPTION: {exc}")
        sys.exit(1)
