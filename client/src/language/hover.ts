import { CancellationToken, Hover, MarkdownString, Position , ProviderResult, TextDocument} from 'vscode';

import * as CONSTANT from "../constants";

const snippetsSmarty = require("../../../snippets/smarty.snippets.json");
const snippetsJavascript = require("../../../snippets/javascript.snippets.json");

export class HoverProvider implements HoverProvider {

	provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {

		const snippets = {
			...snippetsSmarty,
			...snippetsJavascript,
		};

		const range = document.getWordRangeAtPosition(position, /[a-zA-Z_0-9]+/);
		const word = document.getText(range);
		const line = document.lineAt(position).text;

		try {
			const regexOfFunction = new RegExp(`{%/?${word}\\b.*?%}`);
			const regexOfModifier = new RegExp(`{%.*?\\|${word}\\b.*?%}`);
			console.log(line, regexOfModifier.test(line));
			if (!regexOfFunction.test(line) && !regexOfModifier.test(line)) {
				return null;
			}
			if (!snippets[word]) {
				return null;
			}
		}
		catch (error) {
			return null;
		}
		
		const snippet = snippets[word];

		if (!snippet.description.length) {
			return null;
		}

		const md = new MarkdownString();
		// md.appendCodeblock(word);
		md.appendMarkdown(snippet.description);

		if (snippet.reference) {
			md.appendMarkdown(`\n\r[Smarty Reference](${CONSTANT.smartyDocsUri}/${snippet.reference})`);
		}
		return new Hover(md);
	}

}