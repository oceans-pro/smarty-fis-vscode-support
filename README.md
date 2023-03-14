# Smarty Template for Visual Studio Code

This extension is modified from [smarty-vscode-support](https://github.com/aswinkumar863/smarty-vscode-support) to provide [Smarty Template](https://www.smarty.net/) and [Smarty Fis](https://github.com/fex-team/fis3-smarty/) support for Visual Studio Code. 

Except for the basic features of `smarty-vscode-support`, it can:

- Supports `{%...%}` delimiters. Available for both VSCode [desktop](https://code.visualstudio.com/Download) and [web](https://vscode.dev/).

- Supports js or css highlight in `{%script%}` or `{%style%}`.

- Supports path jump, ex: `{%widget name="banana:widget/nav/nav.tpl"%}`.


推荐使用 vscode默认主题 `Dark+` 以获取最佳高亮效果。


如何打包成vsix？

```sh
npm install -g @vscode/vsce
vsce package
```


For Emmet Abbreviations:

Paste the following into your settings.json
```json
"emmet.includeLanguages": {
	"smarty": "html"
},
```