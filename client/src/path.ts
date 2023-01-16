/**
 * @file 代码导航功能
 */

import * as vscode from 'vscode';
import * as CONSTANTS from './constants';
const JSON5 = require("json5").default;

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

class PathDefinitionProvider implements vscode.DefinitionProvider {
    // 兜底，仅暴露两个
    fisNamespaceDirDict: {[k: string]: string} = {
        'common': 'fe-pc-common',
        'm-common': 'fe-wap-common'
    };
    isFisProject: boolean = false;
    isFisProjectFather: boolean = false;

    constructor() {
        this.initFisPathDict();
    }

    async initFisPathDict() {
        const parseNamespace = (fisConfText: string) => {
            // fis.set('namespace', 'list');
            const regRes = /fis\.set\(['"]namespace['"].*['"](.+)['"]/.exec(
                fisConfText
            );
            return regRes && regRes[1];
        }
    
        const getDirname = (path: string) => {
            // /xxx/fe-pc-xxx/fis-conf.js
            const arr = path.split('/');
            return arr[arr.length - 2];
        }
    
        const getNamespaceFromUri = async (uri: string) => {
            const fisDoc = await vscode.workspace.openTextDocument(uri);
            // fis.set('namespace', 'list'); 一般不会超出20行
            const fisDocText = fisDoc.getText(new vscode.Range(
                new vscode.Position(0, 0),
                new vscode.Position(20, 0)
            ));
            const fileNamespace = parseNamespace(fisDocText);
            if (fileNamespace) {
                return fileNamespace;
            }
        }
        // in fe-pc-xxx
        const rootFisConfList = await vscode.workspace.findFiles('fis-conf.js', '**/node_modules/**', 1);
        // in fe-pc-xxx ../
        const allFisConfList = await vscode.workspace.findFiles('*/fis-conf.js', '**/node_modules/**');
        const isFisProject = !!rootFisConfList.length;
        const isFisProjectFather = !!allFisConfList.length && !isFisProject;
    
        if (!isFisProject && !isFisProjectFather) {
            return;
        }
        if (isFisProject) {
            const n = await getNamespaceFromUri(rootFisConfList[0].fsPath);
            const d = getDirname(rootFisConfList[0].fsPath);
            if (d && n) {
                this.fisNamespaceDirDict[n] = d;
            }
            const jsonFiles = await vscode.workspace.findFiles('jsconfig.json');
            if (jsonFiles && jsonFiles[0]) {
                const doc = await vscode.workspace.openTextDocument(jsonFiles[0]);
                const text = doc.getText();
                const config = JSON5.parse(text);
                const paths = config?.compilerOptions?.paths || {};

                Object.keys(paths).forEach(p => {
                    const n = p.split(':')[0];
                    const path = paths[p]?.[0] || '';
                    
                    const slices = path.split('/');
                    // 找到第一个不为 . 和 .. 的
                    const d = slices.find(s => {
                        if (!s.includes('.')) {
                            return s;
                        }
                    });
                    if (n && d) {
                        this.fisNamespaceDirDict[n] = d;
                    }
                });
                
            }
        }
        if (isFisProjectFather) {
            allFisConfList.forEach(async u => {
                const n = await getNamespaceFromUri(u.fsPath);
                const d = getDirname(u.fsPath);
                if (d && n) {
                    this.fisNamespaceDirDict[n] = d;
                }
            });
        }

        this.isFisProject = isFisProject;
        this.isFisProjectFather = isFisProjectFather;
    }

    /**
     * 查找文件定义的provider
     * 当按住Ctrl键时，如果return了一个location，字符串就会变成一个可以点击的链接，否则无任何效果
     * @param document
     * @param position
     * @param token
     * @returns
     */
    public provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
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
                else if (item.type === 'abs') {
                    // 绝对路径 list:widget/sidebar/sidebar.tpl
                    // list
                    const targetNamespace = regRes && regRes[item.namespacePos];
                    // widget/sidebar/sidebar.tpl
                    const targetUri = regRes && regRes[item.uriPos];

                    if (targetNamespace && targetUri) {
                        return this.getRealPath(
                            targetNamespace,
                            targetUri
                        );
                    }
                }
                
            }
        }
    }

    /**
     * 获取绝对路径
     * @param targetNamespace ex: shop
     * @param targetUri ex: widget/banner/banner.tpl
     */
    private async getRealPath(
        targetNamespace: string,
        targetUri: string
    ): Promise<vscode.Location | undefined> {

        if (targetNamespace && targetUri && this.fisNamespaceDirDict[targetNamespace]) {
            const targetDir = this.fisNamespaceDirDict[targetNamespace];
            let uri: vscode.Uri = null;
            if (this.isFisProject) {
                uri = vscode.Uri.joinPath(
                    vscode.workspace.workspaceFolders?.[0]?.uri,
                    '../',
                    targetDir,
                    targetUri
                );
            }
            else if (this.isFisProjectFather) {
                uri = vscode.Uri.joinPath(
                    vscode.workspace.workspaceFolders?.[0]?.uri,
                    targetDir,
                    targetUri
                );
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
            new PathDefinitionProvider()
        )
    );
}
