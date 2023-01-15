/**
 * @file 代码导航功能
 */

import * as vscode from 'vscode';
import * as CONSTANTS from './constants';

const PATH_REG = [
    // extends
    // widget
    // body
    // {%extends file="common/page/layout/admin.tpl"%} 存在点击不了的问题...
    {
        type: 'abs',
        reg:  /(name|framework|file)=['"](.*?)[:/](.*?)['"]/,
        namespacePos: 2,
        uriPos: 3,
    },
    {
        type: 'abs',
        reg: /['"](.*?):(.*?\.js)['"]/,
        namespacePos: 1,
        uriPos: 2,
    },
    {
        type: 'rel',
        reg: /['"](\.\/.*)['"]/
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
    ): Promise<vscode.Location | undefined> {
        const fileName = document.fileName;
        const dirName = vscode.Uri.joinPath(
            vscode.Uri.file(fileName),
            '../'
        );
        
        for(const item of PATH_REG) {
            const range = document.getWordRangeAtPosition(
                position,
                item.reg
            );

            if (range?.isSingleLine) {
                const word = document.getText(range);
                
                const regRes = item.reg.exec(word);
                // 绝对路径 ./nav.js
                if (item.type === 'rel') {
                    const path = vscode.Uri.joinPath(dirName, regRes[1]);

                    return new Promise(resolve => {
                        resolve(new vscode.Location(
                            path,
                            new vscode.Position(0, 0)
                        ));
                    });
                }
                // 相对路径 list:widget/sidebar/sidebar.tpl
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
    private async getTplPathFromFisConf(
        fileName: string,
        uriNamespace: string,
        tplUri: string
    ): Promise<vscode.Location | undefined> {

        const parseNamespace = (fisConfText: string) => {
            // fis.set('namespace', 'list');
            const regRes = /fis\.set\(['"]namespace['"].*['"](.+)['"]/.exec(
                fisConfText
            );
            return regRes && regRes[1];
        
        }
        const fisConfList = await vscode.workspace.findFiles('fis-conf.js', '**/node_modules/**', 1)
        const isFisProject = fisConfList.length;
        
        if (isFisProject) {
            let uri: vscode.Uri = null;
            const fisDoc = await vscode.workspace.openTextDocument(fisConfList[0]);
            // fis.set('namespace', 'list'); 一般不会超出20行
            const fisDocText = fisDoc.getText(new vscode.Range(
                new vscode.Position(0, 0),
                new vscode.Position(20, 0)
            ));
            const currentNamespace = parseNamespace(fisDocText);

            const SPECIAL_MAP: {[k: string]: string} = {
                'common': 'fe-pc-common',
                'm-common': 'fe-wap-common'
            };
            const currentFisConfPath = fisConfList[0];
            const currentFisProjectPath = vscode.Uri.joinPath(currentFisConfPath, '../');

            // vscode.Uri.joinPath();
            // 情况一：引用本模块
            if (currentNamespace === uriNamespace) {
                uri =  vscode.Uri.joinPath(currentFisProjectPath, tplUri);
            }
            // 情况二：引用公共模块（特殊优化）
            else if (SPECIAL_MAP[uriNamespace]) {
                uri = vscode.Uri.joinPath(currentFisProjectPath, '../', SPECIAL_MAP[uriNamespace], tplUri);
            }
            // 情况三：很少见，可以遍历上级目录，暂不进行实现
            else {

            }

            if (uri) {
                return new vscode.Location(
                    uri,
                    new vscode.Position(0, 0)
                )
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
