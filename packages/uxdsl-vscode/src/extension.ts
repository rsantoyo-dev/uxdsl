import * as vscode from 'vscode';
import { completions } from './generated-completions';

export function activate(context: vscode.ExtensionContext) {
    console.log('UXDSL extension is now active!');

    const provider = vscode.languages.registerCompletionItemProvider(
        'uxdsl',
        {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                const linePrefix = document.lineAt(position).text.substr(0, position.character);
                const directive = linePrefix.match(/@(ds-surface|ds-button|ds-input)\([^;{}]*$/);
                if (directive) {
                    const name = directive[1] as keyof typeof completions.directiveArguments;
                    return completions.directiveArguments[name].map(fn => {
                        const item = new vscode.CompletionItem(fn, vscode.CompletionItemKind.Function);
                        item.insertText = new vscode.SnippetString(`${fn}(\${1:key})`);
                        item.detail = 'Configured token override; preserves the other role fields';
                        return item;
                    });
                }

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
        '@', '(', ' '
    );

    context.subscriptions.push(provider);
}

export function deactivate() {}
