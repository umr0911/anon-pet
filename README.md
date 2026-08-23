# anon-pet

千早爱音探头桌宠（dsh web 插件）—— 悬浮在 DSH 网页右下角的一只爱音：

- 悬停 → 探头正放；移开 → 缩头倒放
- 滚轮调大小（80–520px，记忆大小 / 位置）
- 拖拽吸附到左 / 右边缘，左边自动镜像
- 悬停显示 DeepSeek 余额（每 5 分钟刷新）
- **右键菜单**：播放速度（0.25–3x）、循环播放开关、上传图片、重置位置

## 安装

```sh
# 从 GitHub
dsh plugin --profile web add github:umr0911/anon-pet

# 或本地链接
dsh plugin --profile web add link:/path/to/anon-pet-plugin
```

然后重启 `dsh web`。

## 换成你自己的动图

**右键 → 上传图片**：选一张 GIF 上传，直接写入 `assets/anon.gif`（即替换内置图），立即生效、重启后仍在。

缺图时会友好提示「未找到动图，右键上传一张 GIF」。
