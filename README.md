
# 项目目的
一键部署、回滚

# 环境配置

### 1.配置 npm
```shell
# 安装依赖
npm i
```

### 2 服务器文件权限配置
- 给与权限
  - webview_vue/dist    为前端nginx 资源文件目录
  - `chmod -R +w /webview_vue/dist`

### 3. 发布前端包

命令: 
- `node index.js`
  -  默认部署
  -  搜索本地目录最新上传的 .zip 后缀的文件 并且上传该文件，且解压为最新的前端资源文件
- `node index.js -z a1.zip`
  -  指定部署
  -  指定本地目录下 a1.zip 文件 并且上传该文件且解压为最新的前端资源文件
- `node index.js -s`
  - 查询
  -  搜索服务器目录下所有 .zip 后缀的文件
- `node index.js -r a.zip `
  - 回滚
  - 将服务器上名为 a.zip 解压为最新的前端资源文件

# 文件结构

```
├── README.md
├── package.json   
├── index.js      
```
