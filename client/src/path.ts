/**
 * @file 代码导航功能
 */

import * as vscode from 'vscode';
import {CompletionItemKind} from 'vscode-languageclient';
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
        reg: /['"](.*?):(.*?\.(js|ts|tsx|css|less))['"]/,
        namespacePos: 1,
        uriPos: 2,
    },
    {
        type: 'rel',
        reg: /['"](\.\/.*)['"]/
    }
];

class SmartyCompletionItemProvider implements vscode.CompletionItemProvider {
    constructor() {

    }

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
        const line = document.lineAt(position).text;
        const st = line.substring(0, position.character);
        const ed = line.substring(position.character, line.length);
        // sm + tab
        if (st.endsWith('{%') && ed.includes('%}') ) {
            const arr = [
                'ik_json_encode',
                'ik_bridge',
                'block',
                'widget',
                'script',
                'style',
                'foreach'
            ];
            return arr.map(i => ({
                detail: i,
                kind: CompletionItemKind.Function,
                filterText: i,
                label: i,
                insertText: i
            }));
        }
        /**
         * 简易实现
         */
        if (st.includes('{%widget')
            && ed.includes('%}')
            && !st.includes('name=')
        ) {

            return [
                {
                    detail: 'name',
                    kind: CompletionItemKind.Field,
                    filterText: 'name',
                    label: 'name',
                    insertText: 'name="namespace:widgetPath"'
                }
            ];
        }
        // 路径提示暂时没有思路
        // if (st.includes('{%widget')
        //     // && /name=(.*?):/.test(st)
        // ) {

        //     const regRes = /name="(.*?):/.exec(st);
        //     if (regRes && regRes[1]) {
        //         console.log(regRes[1]);
                
        //     }
            
        //     return [
        //         // commitCharacters: [':', '/'],
        //         {
        //             detail: 'name',
        //             kind: CompletionItemKind.Field,
        //             filterText: 'name',
        //             label: 'name',
        //             insertText: 'name="namespace:widgetPath"'
        //         },
        //         {
        //             detail: 'widget/list/list.tpl',
        //             label: 'widget/list/list.tpl',
        //             kind: CompletionItemKind.Field,
        //             filterText: 'widget/list/list.tpl',
        //             insertText: 'widget/list/list.tpl"'
        //         }
        //     ];
        // }
    }
}

class SmartyDefinitionProvider implements vscode.DefinitionProvider {
    // 兜底，仅暴露两个
    fisNamespaceDirDict: {[k: string]: string} = {};
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
            // fis.set('namespace', 'list'); 一般不会超出100行
            const fisDocText = fisDoc.getText(new vscode.Range(
                new vscode.Position(0, 0),
                new vscode.Position(300, 0)
            ));
            const fileNamespace = parseNamespace(fisDocText);
            if (fileNamespace) {
                return fileNamespace;
            }
        }

        const paths: {[k: string]: string} = vscode.workspace.getConfiguration().get('smarty.paths') || {};
        this.fisNamespaceDirDict = paths;
        
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
            const localN = await getNamespaceFromUri(rootFisConfList[0].fsPath);
            const localD = getDirname(rootFisConfList[0].fsPath);
            if (localD && localN) {
                this.fisNamespaceDirDict[localN] = localD;
            }
            const jsonFiles = await vscode.workspace.findFiles('[jt]sconfig.json');
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
                    if (n === localN) {
                        return;
                    }
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
            new SmartyDefinitionProvider()
        )
    );

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            [CONSTANTS.languageId],
            new SmartyCompletionItemProvider(),
            '/',
            ':'
        )
    );
}
