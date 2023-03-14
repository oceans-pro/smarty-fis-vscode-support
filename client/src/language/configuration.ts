import { CharacterPair, languages, TextEditor } from "vscode";

import * as CONSTANT from "../constants";

export function setLanguageConfiguration(activeTextEditor: TextEditor): void {
	let pair: CharacterPair = ["{%*", "%*}"];

	languages.setLanguageConfiguration(CONSTANT.languageId, {
		comments: { blockComment: pair }
	});
}