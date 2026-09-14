import * as vscode from 'vscode';
import { completions } from './generated-completions';

export function activate(context: vscode.ExtensionContext) {
    console.log('UXDSL extension is now active!');

    const provider = vscode.languages.registerCompletionItemProvider(
        'uxdsl',
        {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                const linePrefix = document.lineAt(position).text.substr(0, position.character);

                // Suggest directives if typing '@'
                if (linePrefix.endsWith('@')) {
                    return completions.directives.map(name => new vscode.CompletionItem(name, vscode.CompletionItemKind.Keyword));
                }

                // Suggest functions if inside a value (simplistic check)
                // We'll just provide them generally for now
                const functionCompletions = completions.functions.map(fn => {
                    const item = new vscode.CompletionItem(fn, vscode.CompletionItemKind.Function);
                    item.insertText = new vscode.SnippetString(`${fn}($1)`);
                    return item;
                });

                return functionCompletions;
            }
        },
        '@' // Trigger character
    );

    context.subscriptions.push(provider);
}

export function deactivate() {}
