# Mahjoffg · Three.js 图标概念

使用 Three.js 0.180.0 的 WebGLRenderer 渲染，PNG 直接来自 WebGL 画布。

## 概念稿

所有图片均为 2048 × 2048、RGBA PNG。底板之外或独立符号之外保留真实透明通道。

| 配色 | 圆角底板 | 独立透明符号 |
| --- | --- | --- |
| 天空蓝 | [PNG](exports/mahjoffg-sky-tile-v1.png) | [PNG](exports/mahjoffg-sky-mark-v1.png) |
| 柔和彩虹 | [PNG](exports/mahjoffg-opal-tile-v1.png) | [PNG](exports/mahjoffg-opal-mark-v1.png) |

## 渲染与调整

```sh
python3 server.py
```

打开 http://127.0.0.1:8790 ，选择配色与布局，点击“导出 PNG”。导出按钮会将图片保存到此目录的 `exports/`，同名导出会更新对应概念稿。

`logo.mjs` 包含完整模型与渲染参数：

- 手工定义的贝塞尔 M 轮廓，使用 ExtrudeGeometry 构造浅厚度与圆润倒角。
- 超椭圆底板、MeshPhysicalMaterial 半透明材质、顶点渐变色。
- 环境反射、三盏方向光与半球光。
- 从真实模型投影得到的接触阴影，经过两次 WebGL 高斯模糊。
- 正交相机、ACES 色调映射、sRGB 输出与抗锯齿。

Three.js 及环境光模块固定保存在 `vendor/`，渲染无需外部资源请求；其许可证见 `vendor/LICENSE`。

概念稿单独保存在此目录，网站当前发布包未引用这些文件。
