/**
 * @file 代码
 */

import * as pth from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as CONSTANTS from './constants';
const findRoot = require('find-root');

// extends
// widget
// body
// {%extends file="common/page/layout/admin.tpl"%} 存在点击不了的问题...
const PATH_REG = [
    {
        type: 'attr',
        reg:  /(name|framework|file)=['"](.*?)[:/](.*?)['"]/,
        namespacePos: 2,
        uriPos: 3,
    },
    {
        type: 'js',
        reg: /['"](.*?):(.*?\.js)['"]/,
        namespacePos: 1,
        uriPos: 2,
    }
];

class TplDefinitionProvider implements vscode.DefinitionProvider {
    /**
     * https://www.cnblogs.com/liuxianan/p/vscode-plugin-jump-completion-hover.html#!comments
     * 查找文件定义的provider，匹配到了就return一个location，否则不做处理
     * 最终效果是，当按住Ctrl键时，如果return了一个location，字符串就会变成一个可以点击的链接，否则无任何效果
     * @param document
     * @param position
     * @param token
     * @returns
     */
    public provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
        // ): Thenable<vscode.Location> {s
    ): vscode.Location | undefined {
        const fileName = document.fileName;

        for(const item of PATH_REG) {
            // attr
            const range = document.getWordRangeAtPosition(
                position,
                item.reg
            );
            if (range?.isSingleLine) {
                const word = document.getText(range);
                
                const regRes = item.reg.exec(word);

                // -- list:widget/sidebar/sidebar.tpl
                // list
                const namespace = regRes && regRes[item.namespacePos];
                // widget/sidebar/sidebar.tpl
                const tplUri = regRes && regRes[item.uriPos];
                
                if (namespace && tplUri) {
                    return this.getTplPathFromFisConf(
                        fileName,
                        namespace,
                        tplUri
                    );
                }
            }
        }
    }

    /**
     *
     * @param fisProjectRoot
     * @returns
     */
    private getTplPathFromFisConf(
        fileName: string,
        uriNamespace: string,
        tplUri: string
    ): vscode.Location | undefined {

        const parseNamespace = (fisConfPath: string) => {
            const content = fs.readFileSync(fisConfPath, 'utf-8');
            // fis.set('namespace', 'list');
            const regRes = /fis\.set\(['"]namespace['"].*['"](.+)['"]/.exec(
                content
            );
            return regRes && regRes[1];
        }

        if (fileName) {
            const currentFisProjectRoot = findRoot(fileName) as string;
			const currentFisConfPath = pth.join(currentFisProjectRoot, 'fis-conf.js');
            // 当前为fis-conf项目才进行下面操作
            if (fs.existsSync(currentFisConfPath)) {
 
                const SPECIAL_MAP: {[k: string]: string} = {
                    'common': 'fe-pc-common',
                    'm-common': 'fe-wap-common'
                };
                const currentNamespace = parseNamespace(currentFisConfPath);
                
                // 情况一：引用本模块
                if (currentNamespace === uriNamespace) {
                    const uri =  pth.join(currentFisProjectRoot, tplUri);
                    return new vscode.Location(
                        vscode.Uri.file(uri),
                        new vscode.Position(0, 0)
                    )
                }
                // 情况二：引用公共模块（特殊优化）
                else if (SPECIAL_MAP[uriNamespace]) {
                    const uri =  pth.resolve(currentFisProjectRoot, '../', SPECIAL_MAP[uriNamespace], tplUri);
                    return new vscode.Location(
                        vscode.Uri.file(uri),
                        new vscode.Position(0, 0)
                    )
                }
                // 情况三：很少见，可以遍历上级目录，暂不进行实现
                else {

                }
            }
        }
    }
}

export function usePathHintAndJump(context: vscode.ExtensionContext) {
	context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            [CONSTANTS.languageId],
            new TplDefinitionProvider()
        )
    );
}