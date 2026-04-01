import sys
import os
import traceback

print("=== 脚本开始执行 ===", flush=True)
print(f"Python版本: {sys.version}", flush=True)
print(f"参数数量: {len(sys.argv)}", flush=True)
print(f"参数: {sys.argv}", flush=True)

if len(sys.argv) != 4:
    print("错误: 参数数量不对，需要3个参数", flush=True)
    sys.exit(1)

input_path = sys.argv[1]
output_path = sys.argv[2]
distance = sys.argv[3]

print(f"输入路径: {input_path}", flush=True)
print(f"输出路径: {output_path}", flush=True)
print(f"距离: {distance}", flush=True)

try:
    from osgeo import ogr, osr, gdal
    print("GDAL导入成功", flush=True)
    print(f"GDAL版本: {gdal.VersionInfo()}", flush=True)
except Exception as e:
    print(f"GDAL导入失败: {e}", flush=True)
    traceback.print_exc()
    sys.exit(1)

# 检查输入文件
print(f"检查输入文件是否存在...", flush=True)
if os.path.exists(input_path):
    print(f"输入文件存在，大小: {os.path.getsize(input_path)} bytes", flush=True)
else:
    print(f"输入文件不存在: {input_path}", flush=True)
    dir_path = os.path.dirname(input_path)
    if os.path.exists(dir_path):
        print(f"目录存在，内容: {os.listdir(dir_path)}", flush=True)
    else:
        print(f"目录也不存在: {dir_path}", flush=True)

print("=== 测试完成 ===", flush=True)
print("PYTHON_SUCCESS", flush=True)