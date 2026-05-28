import os
import sys

import numpy as np
from osgeo import gdal


gdal.UseExceptions()


def parse_nodata(raw_value: str):
    if raw_value == "none":
        return None
    return float(raw_value)


def read_source_band(dataset, band_index: int) -> tuple[np.ndarray, float | None]:
    if band_index < 1 or band_index > dataset.RasterCount:
        raise RuntimeError(
            f"Band index {band_index} is out of range. Raster has {dataset.RasterCount} bands."
        )

    band = dataset.GetRasterBand(band_index)
    return band.ReadAsArray().astype(np.float32), band.GetNoDataValue()


def stretch_to_byte(values: np.ndarray, invalid: np.ndarray, method: str) -> np.ndarray:
    valid_values = values[~invalid]
    if valid_values.size == 0:
        return np.zeros(values.shape, dtype=np.uint8)

    if method == "none":
        scaled = values
    else:
        if method == "percent":
            low, high = np.percentile(valid_values, [2, 98])
        elif method == "minmax":
            low, high = np.min(valid_values), np.max(valid_values)
        else:
            raise RuntimeError(f"Unsupported stretch method: {method}")

        if np.isclose(high, low):
            scaled = np.zeros(values.shape, dtype=np.float32)
        else:
            scaled = (values - low) * 255.0 / (high - low)

    scaled = np.where(invalid | ~np.isfinite(scaled), 0, scaled)
    return np.clip(scaled, 0, 255).astype(np.uint8)


def create_band_composite(
    input_path: str,
    output_path: str,
    red_band_index: int,
    green_band_index: int,
    blue_band_index: int,
    stretch: str,
    output_nodata,
) -> None:
    if not os.path.exists(input_path):
        raise RuntimeError(f"Input raster not found: {input_path}")

    dataset = gdal.Open(input_path)
    if dataset is None:
        raise RuntimeError("Unable to open input raster.")

    band_indexes = [red_band_index, green_band_index, blue_band_index]
    channels = []
    for band_index in band_indexes:
        values, source_nodata = read_source_band(dataset, band_index)
        invalid = np.zeros(values.shape, dtype=bool)
        if source_nodata is not None:
            invalid |= values == source_nodata
        if output_nodata is not None:
            invalid |= values == output_nodata
        channels.append(stretch_to_byte(values, invalid, stretch))

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    driver = gdal.GetDriverByName("GTiff")
    output = driver.Create(
        output_path,
        dataset.RasterXSize,
        dataset.RasterYSize,
        3,
        gdal.GDT_Byte,
        options=["TILED=YES", "COMPRESS=LZW", "PHOTOMETRIC=RGB", "BIGTIFF=IF_SAFER"],
    )
    if output is None:
        raise RuntimeError("Unable to create output raster.")

    output.SetGeoTransform(dataset.GetGeoTransform())
    output.SetProjection(dataset.GetProjection())
    for channel_index, channel in enumerate(channels, start=1):
        output_band = output.GetRasterBand(channel_index)
        output_band.WriteArray(channel)
        output_band.SetColorInterpretation(
            [gdal.GCI_RedBand, gdal.GCI_GreenBand, gdal.GCI_BlueBand][channel_index - 1]
        )
        output_band.FlushCache()

    output.FlushCache()
    output = None
    dataset = None

    if not os.path.exists(output_path):
        raise RuntimeError(f"Band composite output not created: {output_path}")


if __name__ == "__main__":
    try:
        create_band_composite(
            sys.argv[1],
            sys.argv[2],
            int(sys.argv[3]),
            int(sys.argv[4]),
            int(sys.argv[5]),
            sys.argv[6].lower(),
            parse_nodata(sys.argv[7]),
        )
        print(f"PYTHON_SUCCESS: band_composite={sys.argv[2]}")
    except Exception as exc:
        print(f"PYTHON_EXCEPTION: {exc}")
        sys.exit(1)
